"""
Lao Lottery & Sokxay Domain Service
Handles the 40 official Lao animal numbers, multiplier prize table, ticket generation, and draw result evaluation.
"""

import random
import secrets
from decimal import Decimal
from typing import List, Dict, Any, Optional

# The 40 Official Lao Animals (ນາມສັດ 40 ໂຕ ຕາມມາດຕະຖານຫວຍລາວ ໂຊກໄຊ)
LAO_ANIMALS = [
    {"id": 1, "name_lo": "ປາໃຫຍ່", "name_en": "Big Fish", "base": "01", "related": "01, 41, 81", "icon": "🐟"},
    {"id": 2, "name_lo": "ຫອຍ", "name_en": "Snail", "base": "02", "related": "02, 42, 82", "icon": "🐚"},
    {"id": 3, "name_lo": "ຫ່ານ", "name_en": "Goose", "base": "03", "related": "03, 43, 83", "icon": "🪿"},
    {"id": 4, "name_lo": "ນົກຍູງ", "name_en": "Peacock", "base": "04", "related": "04, 44, 84", "icon": "🦚"},
    {"id": 5, "name_lo": "ສິງ", "name_en": "Lion", "base": "05", "related": "05, 45, 85", "icon": "🦁"},
    {"id": 6, "name_lo": "ເສືອ", "name_en": "Tiger", "base": "06", "related": "06, 46, 86", "icon": "🐯"},
    {"id": 7, "name_lo": "ໝູ", "name_en": "Pig", "base": "07", "related": "07, 47, 87", "icon": "🐷"},
    {"id": 8, "name_lo": "ກະຕ່າຍ", "name_en": "Rabbit", "base": "08", "related": "08, 48, 88", "icon": "🐰"},
    {"id": 9, "name_lo": "ຄວາຍ", "name_en": "Buffalo", "base": "09", "related": "09, 49, 89", "icon": "🐃"},
    {"id": 10, "name_lo": "ນາກບິນ", "name_en": "Flying Dragon", "base": "10", "related": "10, 50, 90", "icon": "🐉"},
    {"id": 11, "name_lo": "ໝາ", "name_en": "Dog", "base": "11", "related": "11, 51, 91", "icon": "🐶"},
    {"id": 12, "name_lo": "ມ້າ", "name_en": "Horse", "base": "12", "related": "12, 52, 92", "icon": "🐴"},
    {"id": 13, "name_lo": "ຊ້າງ", "name_en": "Elephant", "base": "13", "related": "13, 53, 93", "icon": "🐘"},
    {"id": 14, "name_lo": "ແມວບ້ານ", "name_en": "Cat", "base": "14", "related": "14, 54, 94", "icon": "🐱"},
    {"id": 15, "name_lo": "ໜູ", "name_en": "Rat", "base": "15", "related": "15, 55, 95", "icon": "🐭"},
    {"id": 16, "name_lo": "ເຜິ້ງ", "name_en": "Bee", "base": "16", "related": "16, 56, 96", "icon": "🐝"},
    {"id": 17, "name_lo": "ນົກກາງແກ", "name_en": "Pigeon", "base": "17", "related": "17, 57, 97", "icon": "🕊️"},
    {"id": 18, "name_lo": "ແຄ້ວ / ແຂ້", "name_en": "Crocodile", "base": "18", "related": "18, 58, 98", "icon": "🐊"},
    {"id": 19, "name_lo": "ແມງກະເບື້ອ", "name_en": "Butterfly", "base": "19", "related": "19, 59, 99", "icon": "🦋"},
    {"id": 20, "name_lo": "ຂີ້ເຂັບ", "name_en": "Centipede", "base": "20", "related": "20, 60, 00", "icon": "🐛"},
    {"id": 21, "name_lo": "ນົກກືດ", "name_en": "Swallow", "base": "21", "related": "21, 61", "icon": "🐦"},
    {"id": 22, "name_lo": "ນົກກົກ", "name_en": "Hornbill", "base": "22", "related": "22, 62", "icon": "🦜"},
    {"id": 23, "name_lo": "ລີງ", "name_en": "Monkey", "base": "23", "related": "23, 63", "icon": "🐒"},
    {"id": 24, "name_lo": "ກົບ", "name_en": "Frog", "base": "24", "related": "24, 64", "icon": "🐸"},
    {"id": 25, "name_lo": "ເຫງັ້ນ", "name_en": "Civet", "base": "25", "related": "25, 65", "icon": "🦡"},
    {"id": 26, "name_lo": "ນົກເຂົາ", "name_en": "Turtle Dove", "base": "26", "related": "26, 66", "icon": "🐦‍⬛"},
    {"id": 27, "name_lo": "ເຕົ່າ", "name_en": "Turtle", "base": "27", "related": "27, 67", "icon": "🐢"},
    {"id": 28, "name_lo": "ໄກ່", "name_en": "Rooster", "base": "28", "related": "28, 68", "icon": "🐓"},
    {"id": 29, "name_lo": "ອຽນ", "name_en": "Eel", "base": "29", "related": "29, 69", "icon": "🐍"},
    {"id": 30, "name_lo": "ປານ້ອຍ", "name_en": "Small Fish", "base": "30", "related": "30, 70", "icon": "🐠"},
    {"id": 31, "name_lo": "ກຸ້ງ", "name_en": "Shrimp", "base": "31", "related": "31, 71", "icon": "🦐"},
    {"id": 32, "name_lo": "ງູ", "name_en": "Snake", "base": "32", "related": "32, 72", "icon": "🐍"},
    {"id": 33, "name_lo": "ແມງມຸມ", "name_en": "Spider", "base": "33", "related": "33, 73", "icon": "🕷️"},
    {"id": 34, "name_lo": "ກວາງ", "name_en": "Deer", "base": "34", "related": "34, 74", "icon": "🦌"},
    {"id": 35, "name_lo": "ແບ້", "name_en": "Goat", "base": "35", "related": "35, 75", "icon": "🐐"},
    {"id": 36, "name_lo": "ເຫຍັ້ນ", "name_en": "Otter", "base": "36", "related": "36, 76", "icon": "🦦"},
    {"id": 37, "name_lo": "ຕຸ່ນ", "name_en": "Bamboo Rat", "base": "37", "related": "37, 77", "icon": "🦔"},
    {"id": 38, "name_lo": "ໝາໄນ", "name_en": "Wolf", "base": "38", "related": "38, 78", "icon": "🐺"},
    {"id": 39, "name_lo": "ແມ່ໝີ", "name_en": "Bear", "base": "39", "related": "39, 79", "icon": "🐻"},
    {"id": 40, "name_lo": "ນົກອິນຊີ", "name_en": "Eagle", "base": "40", "related": "40, 80", "icon": "🦅"}
]

PRIZE_MULTIPLIERS = {
    "DIGIT_1": Decimal("8.5"),     # 1,000 -> 8,500 LAK
    "DIGIT_2": Decimal("60.0"),    # 1,000 -> 60,000 LAK
    "DIGIT_3": Decimal("500.0"),   # 1,000 -> 500,000 LAK
    "DIGIT_4": Decimal("6000.0"),  # 1,000 -> 6,000,000 LAK
    "DIGIT_5": Decimal("40000.0"), # 1,000 -> 40,000,000 LAK
    "DIGIT_6": Decimal("400000.0"),# 1,000 -> 400,000,000 LAK
    "ANIMAL": Decimal("60.0")      # 1,000 -> 60,000 LAK
}


class LotteryEngine:
    @staticmethod
    def get_all_animals() -> List[Dict[str, Any]]:
        return LAO_ANIMALS

    @staticmethod
    def get_animal_by_id(animal_id: int) -> Optional[Dict[str, Any]]:
        for a in LAO_ANIMALS:
            if a["id"] == animal_id:
                return a
        return None

    @staticmethod
    def get_multiplier(bet_type: str) -> Decimal:
        return PRIZE_MULTIPLIERS.get(bet_type.upper(), Decimal("1.0"))

    @staticmethod
    def generate_serial() -> str:
        """Generates UniLotary standard ticket serial code (e.g. UL-2026-9482-1049)."""
        chunk1 = secrets.token_hex(2).upper()
        chunk2 = str(random.randint(1000, 9999))
        chunk3 = str(random.randint(1000, 9999))
        return f"UL-2026-{chunk2}-{chunk3}"

    @staticmethod
    def generate_random_digits(count: int) -> str:
        """Quick pick generator for lucky numbers."""
        return "".join([str(random.randint(0, 9)) for _ in range(count)])

    @staticmethod
    def evaluate_item(
        winning_6_digits: str,
        bet_type: str,
        chosen_number: str,
        bet_amount: Decimal,
        multiplier: Decimal
    ) -> Dict[str, Any]:
        """
        Evaluates a single ticket item against the 6-digit winning draw result.
        Lao Lottery rules:
        - DIGIT_1: compares to last 1 digit (draw[-1])
        - DIGIT_2: compares to last 2 digits (draw[-2:])
        - DIGIT_3: compares to last 3 digits (draw[-3:])
        - DIGIT_4: compares to last 4 digits (draw[-4:])
        - DIGIT_5: compares to last 5 digits (draw[-5:])
        - DIGIT_6: compares to full 6 digits (draw)
        - ANIMAL: matches 2-digit animal number to last 2 digits
        """
        draw_clean = str(winning_6_digits).zfill(6)
        num_clean = str(chosen_number).strip()
        is_win = False

        if bet_type == "DIGIT_1":
            is_win = (draw_clean[-1] == num_clean[-1])
        elif bet_type in ("DIGIT_2", "ANIMAL"):
            is_win = (draw_clean[-2:] == num_clean.zfill(2)[-2:])
        elif bet_type == "DIGIT_3":
            is_win = (draw_clean[-3:] == num_clean.zfill(3)[-3:])
        elif bet_type == "DIGIT_4":
            is_win = (draw_clean[-4:] == num_clean.zfill(4)[-4:])
        elif bet_type == "DIGIT_5":
            is_win = (draw_clean[-5:] == num_clean.zfill(5)[-5:])
        elif bet_type == "DIGIT_6":
            is_win = (draw_clean == num_clean.zfill(6))

        actual_win = (bet_amount * multiplier) if is_win else Decimal("0.00")
        return {
            "is_win": is_win,
            "actual_win": actual_win
        }
