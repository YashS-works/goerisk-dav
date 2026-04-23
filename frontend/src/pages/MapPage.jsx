import WorldMap from '../components/map/WorldMap'
import ShockControls from '../components/controls/ShockControls'
import StatsStrip from '../components/shared/StatsStrip'

export default function MapPage() {
    return (
        <div>
            <div className="px-6 pt-5 pb-0">
                <div className="mb-1">
                    <span className="text-xs font-bold text-brand bg-brand-xl
            px-3 py-1 rounded-full font-mono tracking-widest">
                        01 · WORLD MAP
                    </span>
                </div>
                <h1 className="text-2xl font-bold text-ink tracking-tight mb-1">
                    Conflict Selector — Interactive World Map
                </h1>
                <p className="text-sm text-ink-3 mb-4">
                    Click any country to set conflict parties.
                    The map shows live SI heat, cascade paths
                    and affected country markers.
                </p>
            </div>
            <WorldMap />
            <ShockControls />
            <StatsStrip />
        </div>
    )
}