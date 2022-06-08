from fastapi import FastAPI
from starlette.responses import HTMLResponse

import photoparty

MSA_PACKAGES = [
    photoparty
]

app = FastAPI()


@app.on_event("startup")
async def startup_event():
    for pkg in MSA_PACKAGES:
        if hasattr(pkg, "register_msa_subapp"):
            await pkg.register_msa_subapp(app)


@app.get("/", response_class=HTMLResponse)
async def msapage():
    page = await photoparty.msa_get_as_page()
    return f"""<html>
<head>
    <title>photoparty</title>
    <style>
        html, body {{
            width: 100%;
            height: 100%;
            padding: 0;
            margin: 0;
        }}
    </style>
    {page.get('head', '')}
</head>
<body>
    {page.get('body', '')}
</body>
</html>"""
