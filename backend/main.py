from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from vision import recognize_fen

app = FastAPI(title="Chess Vision API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/recognize")
async def recognize(file: UploadFile):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image")
    image_bytes = await file.read()
    try:
        fen = await recognize_fen(image_bytes)
        return {"fen": fen}
    except Exception as e:
        raise HTTPException(500, f"Recognition failed: {e}")


@app.get("/health")
def health():
    return {"status": "ok"}
