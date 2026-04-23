import asyncio
from services.rest_countries import fetch_all_countries
from services.world_bank import fetch_all_indicators
from services.eia_energy import fetch_energy_imports, fetch_international_energy
from services.fao_food import fetch_all_food_data
from services.oec_trade import fetch_all_trade_data
from services.acled_conflicts import get_fallback_conflicts

class DataCache:
    def __init__(self):
        self.countries      = {}
        self.wb_data        = {}
        self.energy_imports = {}
        self.intl_energy    = {}
        self.food_data      = {}
        self.trade_data     = {}
        self.conflicts      = []
        self.is_ready       = False

    async def initialize(self):
        try:
            print("  → Phase 1: Countries + World Bank...")
            phase1 = await asyncio.gather(
                fetch_all_countries(),
                fetch_all_indicators()
            )
            self.countries = phase1[0]
            self.wb_data   = phase1[1]

            print("  → Phase 2: Energy + Food + Trade...")
            phase2 = await asyncio.gather(
                fetch_energy_imports(),
                fetch_international_energy(),
                fetch_all_food_data(),
                fetch_all_trade_data()
            )
            self.energy_imports = phase2[0]
            self.intl_energy    = phase2[1]
            self.food_data      = phase2[2]
            self.trade_data     = phase2[3]

            print("  → Phase 3: Loading fallback conflict data...")
            self.conflicts = get_fallback_conflicts()

            self.is_ready = True
            print("  ✅ All data loaded successfully")
            print(f"     Countries : {len(self.countries)}")
            print(f"     WB data   : {len(self.wb_data)}")
            print(f"     Energy    : {len(self.energy_imports)}")
            print(f"     Food      : {len(self.food_data)}")
            print(f"     Trade     : {len(self.trade_data)}")
            print(f"     Conflicts : {len(self.conflicts)} (fallback)")

        except Exception as e:
            print(f"  ❌ Cache init error: {e}")
            self.is_ready = False

    def clear(self):
        self.countries      = {}
        self.wb_data        = {}
        self.energy_imports = {}
        self.intl_energy    = {}
        self.food_data      = {}
        self.trade_data     = {}
        self.conflicts      = []
        self.is_ready       = False

    def get_summary(self) -> dict:
        return {
            "countries":  len(self.countries),
            "wb_data":    len(self.wb_data),
            "energy":     len(self.energy_imports),
            "food":       len(self.food_data),
            "trade":      len(self.trade_data),
            "conflicts":  len(self.conflicts),
            "is_ready":   self.is_ready
        }