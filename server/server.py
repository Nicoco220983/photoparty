import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

import photoparty

MSA_PACKAGES = [
    photoparty
]

HERE = os.path.abspath(os.path.dirname(__file__))

app = FastAPI()


@app.on_event("startup")
async def startup_event():
    for pkg in MSA_PACKAGES:
        if hasattr(pkg, "register_msa_subapp"):
            await pkg.register_msa_subapp(app)


STATIC_DIR = os.path.join(HERE, "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def root():
    return FileResponse(os.path.join(HERE, "static/index.html"))