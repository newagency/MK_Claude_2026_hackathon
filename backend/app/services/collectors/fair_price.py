class PriceForensics:
    @staticmethod
    def calculate_markup_delta(wholesale_price: float, retail_price: float):
        """
        Calculates the percentage gap between auction floor and retail.
        A widening gap during a news cycle suggests 'Margin Padding'.
        """
        if wholesale_price == 0:
            return 0
        return ((retail_price - wholesale_price) / wholesale_price) * 100

    @staticmethod
    def detect_rocket_feather(historical_data: list) -> dict:
        """
        Analyzes the asymmetry between upward and downward price adjustment speed.
        'Rocket & Feather': prices rise quickly (rocket) but fall slowly (feather).
        Returns an asymmetry_ratio > 2.0 as a flag for suspected manipulation.
        """
        if len(historical_data) < 3:
            return {"is_feather": False, "up_velocity": 0, "down_velocity": 0, "asymmetry_ratio": 1.0}

        prices = [d["avg_price_current"] for d in historical_data]

        up_moves = []
        down_moves = []
        for i in range(1, len(prices)):
            delta = prices[i] - prices[i - 1]
            if delta > 0:
                up_moves.append(delta)
            elif delta < 0:
                down_moves.append(abs(delta))

        avg_up = sum(up_moves) / len(up_moves) if up_moves else 0
        avg_down = sum(down_moves) / len(down_moves) if down_moves else 0

        # Avoid division by zero; if prices only went up, asymmetry is maximal
        if avg_down == 0:
            asymmetry = float("inf") if avg_up > 0 else 1.0
        else:
            asymmetry = avg_up / avg_down

        return {
            "is_feather": asymmetry > 2.0,
            "up_velocity": round(avg_up, 0),
            "down_velocity": round(avg_down, 0),
            "asymmetry_ratio": round(asymmetry, 2) if asymmetry != float("inf") else 99.0,
        }
