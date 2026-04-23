import networkx as nx

def build_graph(countries: dict, wb_data: dict, si_scores: dict) -> nx.DiGraph:
    """
    Builds a directed graph of country dependencies.
    Nodes = countries
    Edges = dependency relationships
    Node weight = SI score
    """
    G = nx.DiGraph()

    # Add nodes
    for code, country in countries.items():
        si = si_scores.get(code, {})
        G.add_node(
            code,
            name         = country.get("name", ""),
            region       = country.get("region", ""),
            lat          = country.get("lat", 0),
            lon          = country.get("lon", 0),
            composite_si = si.get("composite_si", 0),
            energy_si    = si.get("energy_si", 0),
            trade_si     = si.get("trade_si", 0),
            food_si      = si.get("food_si", 0),
            risk_level   = si.get("risk_level", "unknown")
        )

    # Add edges from border relationships
    for code, country in countries.items():
        borders = country.get("borders", [])
        si_val  = si_scores.get(code, {}).get("composite_si", 0)
        for neighbour in borders:
            if neighbour in countries:
                n_si = si_scores.get(
                    neighbour, {}
                ).get("composite_si", 0)
                # Edge weight = average SI of both countries
                weight = round((si_val + n_si) / 2, 3)
                G.add_edge(code, neighbour, weight=weight)

    return G


def get_centrality(G: nx.DiGraph) -> dict:
    """
    Computes multiple centrality metrics.
    Higher = more important in cascade network.
    """
    try:
        betweenness = nx.betweenness_centrality(
            G, weight="weight", normalized=True
        )
    except Exception:
        betweenness = {}

    try:
        in_degree = dict(G.in_degree(weight="weight"))
    except Exception:
        in_degree = {}

    try:
        pagerank = nx.pagerank(
            G, weight="weight", max_iter=100
        )
    except Exception:
        pagerank = {}

    try:
        closeness = nx.closeness_centrality(G)
    except Exception:
        closeness = {}

    # Combine into single score
    all_nodes  = set(betweenness) | set(pagerank)
    combined   = {}

    for node in all_nodes:
        b = betweenness.get(node, 0)
        p = pagerank.get(node, 0)
        c = closeness.get(node, 0)
        d = in_degree.get(node, 0)

        # Normalize in_degree
        max_d = max(in_degree.values()) if in_degree else 1
        d_norm = d / max_d if max_d > 0 else 0

        combined[node] = round(
            (b * 0.35) + (p * 100 * 0.25) +
            (c * 0.25) + (d_norm * 0.15),
            4
        )

    return {
        "betweenness": betweenness,
        "pagerank":    pagerank,
        "closeness":   closeness,
        "in_degree":   in_degree,
        "combined":    combined
    }


def find_bottlenecks(
    G:          nx.DiGraph,
    si_scores:  dict,
    top_n:      int = 10
) -> list:
    """
    Finds countries whose removal would most
    disrupt the cascade network.
    """
    centrality = get_centrality(G)
    combined   = centrality["combined"]

    bottlenecks = []
    for code, score in combined.items():
        si = si_scores.get(code, {})
        bottlenecks.append({
            "country_code":    code,
            "name":            G.nodes[code].get("name", code),
            "centrality":      score,
            "composite_si":    si.get("composite_si", 0),
            "risk_level":      si.get("risk_level", "unknown"),
            "risk_color":      si.get("risk_color", "#94a3b8"),
            "region":          G.nodes[code].get("region", ""),
            "cascade_impact":  round(score * si.get("composite_si", 0), 4)
        })

    bottlenecks.sort(
        key=lambda x: x["cascade_impact"],
        reverse=True
    )

    return bottlenecks[:top_n]


def detect_clusters(
    G:         nx.DiGraph,
    si_scores: dict,
    threshold: float = 0.40
) -> list:
    """
    Identifies vulnerability clusters —
    groups of high-SI countries connected
    to each other in the network.
    """
    # Filter high-risk nodes
    high_risk = [
        n for n in G.nodes()
        if si_scores.get(n, {}).get("composite_si", 0) >= threshold
    ]

    if not high_risk:
        return []

    # Get subgraph of high-risk countries
    subgraph = G.subgraph(high_risk).copy()

    # Find connected components
    undirected = subgraph.to_undirected()
    components = list(
        nx.connected_components(undirected)
    )

    clusters = []
    for i, component in enumerate(components):
        if len(component) < 2:
            continue

        members = []
        for code in component:
            si = si_scores.get(code, {})
            members.append({
                "country_code": code,
                "name":         G.nodes[code].get("name", code),
                "composite_si": si.get("composite_si", 0),
                "risk_level":   si.get("risk_level", "unknown"),
                "region":       G.nodes[code].get("region", "")
            })

        members.sort(
            key=lambda x: x["composite_si"],
            reverse=True
        )

        avg_si = round(
            sum(m["composite_si"] for m in members) / len(members),
            3
        )

        # Determine cluster domain
        regions = [m["region"] for m in members]
        dominant_region = max(
            set(regions), key=regions.count
        )

        clusters.append({
            "cluster_id":    i + 1,
            "size":          len(members),
            "avg_si":        avg_si,
            "region":        dominant_region,
            "risk_level":    "critical" if avg_si >= 0.75 else "high",
            "members":       members,
            "label":         f"Cluster {i+1} — {dominant_region}"
        })

    clusters.sort(key=lambda x: x["avg_si"], reverse=True)
    return clusters


def find_cascade_path(
    G:           nx.DiGraph,
    origin_code: str,
    target_code: str
) -> dict:
    """
    Finds shortest cascade path between
    two countries in the network.
    """
    try:
        path = nx.shortest_path(
            G,
            source = origin_code,
            target = target_code,
            weight = "weight"
        )
        length = nx.shortest_path_length(
            G,
            source = origin_code,
            target = target_code,
            weight = "weight"
        )
        return {
            "found":   True,
            "path":    path,
            "length":  len(path),
            "weight":  round(length, 3)
        }
    except nx.NetworkXNoPath:
        return {
            "found":  False,
            "path":   [],
            "length": 0,
            "weight": 0
        }
    except Exception as e:
        return {
            "found":  False,
            "path":   [],
            "length": 0,
            "weight": 0,
            "error":  str(e)
        }


def get_network_data_for_frontend(
    G:          nx.DiGraph,
    si_scores:  dict,
    max_nodes:  int = 60
) -> dict:
    """
    Returns network data formatted for
    D3 force graph on frontend.
    Limits to top nodes for performance.
    """
    # Get top nodes by SI score
    all_nodes = [
        (code, si_scores.get(code, {}).get("composite_si", 0))
        for code in G.nodes()
        if code in si_scores
    ]
    all_nodes.sort(key=lambda x: x[1], reverse=True)
    top_codes = {code for code, _ in all_nodes[:max_nodes]}

    nodes = []
    for code in top_codes:
        si   = si_scores.get(code, {})
        node = G.nodes.get(code, {})
        nodes.append({
            "id":           code,
            "name":         node.get("name", code),
            "region":       node.get("region", ""),
            "lat":          node.get("lat", 0),
            "lon":          node.get("lon", 0),
            "composite_si": si.get("composite_si", 0),
            "energy_si":    si.get("energy_si", 0),
            "trade_si":     si.get("trade_si", 0),
            "food_si":      si.get("food_si", 0),
            "risk_level":   si.get("risk_level", "unknown"),
            "risk_color":   si.get("risk_color", "#94a3b8"),
            "size":         max(6, si.get("composite_si", 0) * 20)
        })

    edges = []
    for u, v, data in G.edges(data=True):
        if u in top_codes and v in top_codes:
            edges.append({
                "source": u,
                "target": v,
                "weight": round(data.get("weight", 0), 3)
            })

    return {
        "nodes": nodes,
        "edges": edges,
        "count": {
            "nodes": len(nodes),
            "edges": len(edges)
        }
    }