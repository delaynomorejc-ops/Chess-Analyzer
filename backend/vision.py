import asyncio
import base64
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv("../.env")

client = OpenAI(
    api_key=os.getenv("DOUBAO_API_KEY"),
    base_url=os.getenv("DOUBAO_BASE_URL"),
)

PROMPT = (
    "This is a screenshot of a digital chess board. "
    "The board uses standard chess piece icons. "
    "Carefully identify every piece on every square. "
    "White pieces are light-colored, black pieces are dark-colored. "
    "Output ONLY the FEN string (position part + side to move + castling + en passant + halfmove + fullmove). "
    "No explanation, no markdown, just the raw FEN string."
)


def _call_api(b64: str) -> str:
    response = client.chat.completions.create(
        model=os.getenv("DOUBAO_MODEL"),
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
    )
    return response.choices[0].message.content.strip()


async def recognize_fen(image_bytes: bytes) -> str:
    b64 = base64.b64encode(image_bytes).decode()
    fen = await asyncio.to_thread(_call_api, b64)
    return fen
