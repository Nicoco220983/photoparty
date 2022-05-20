import os
import io
from typing import List
import random
import functools
import urllib.parse
import socket
import base64

import qrcode

from fastapi import FastAPI, Request, Depends, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

import pydantic as pyd
import aiofiles

HERE = os.path.abspath(os.path.dirname(__file__))
STATIC_DIR = os.path.join(HERE, "static")


async def register_msa_subapp(app):
    PhotoParty().register_msa_subapp(app)


class PhotoParty():

    def __init__(self):
        self.init_photos_dir()
        self.photonames = set(self.list_photonames())
        self.new_photonames = []


    def register_msa_subapp(self, app):

        subapp = FastAPI()
        app.mount("/msa/photoparty", subapp)

        subapp.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
        subapp.mount("/photo", StaticFiles(directory=self.get_photos_dirpath()), name="photo")

        class GetUrlRes(pyd.BaseModel):
            url: str

        @subapp.get("/url/{url_b64}", response_model=GetUrlRes)
        async def get_url(url_b64: str):
            url = base64.b64decode(url_b64)
            return GetUrlRes(url=self.get_url(url))

        @subapp.get("/qrcode/{url_b64}")
        async def get_qrcode(url_b64: str):
            url = base64.b64decode(url_b64)
            return Response(content=self.get_url_qrcode(url))

        class GetNextPhotoNameRes(pyd.BaseModel):
            name: str | None

        @subapp.get("/next_photoname", response_model=GetNextPhotoNameRes)
        async def get_next_photoname(prev_photos: str):
            name = self.get_next_photoname(prev_photos.split(',') if prev_photos else [])
            if name is None:
                raise HTTPException(status_code=404, detail="There is no photo yet")
            return GetNextPhotoNameRes(name=name)

        @subapp.post("/photos")
        async def upload_photo(photos: List[UploadFile]):
            for photo in photos:
                fname = self.gen_new_filename(photo.filename)
                self.photonames.add(fname)
                self.new_photonames.append(fname)
                await self.write_file(photo, fname)
        
        @subapp.delete("/_photo/{pname}")
        async def delete_photo(pname: str):
            await self.remove_file(pname)
    

    def get_photos_dirpath(self):
        return os.getenv("PHOTOPARTY_DIR", os.path.join(HERE, "_photos"))
    

    def init_photos_dir(self):
        os.makedirs(self.get_photos_dirpath(), exist_ok=True)
    

    def list_photonames(self):
        dirpath = self.get_photos_dirpath()
        return [
            self.normalize_photoname(f)
            for f in os.listdir(dirpath)
            if os.path.isfile(os.path.join(dirpath, f))
        ]
    

    def normalize_photoname(self, pname):
        # TODO
        return pname
    

    def get_next_photoname(self, prev_photonames):
        if self.new_photonames:
            return self.new_photonames.pop(0)
        if not self.photonames:
            return
        nb_tries = 10
        while True:
            pname = random.sample(self.photonames, 1)[0]
            if (nb_tries == 0) or (pname not in prev_photonames):
                return pname
            nb_tries -= 1


    def gen_new_filename(self, fname):
        fbase, fext = os.path.splitext(fname)
        i = 1
        while True:
            new_fname = fname if i <= 1 else f"{fbase}_{i}{fext}"
            if self.normalize_photoname(new_fname) not in self.photonames:
                return new_fname
            i += 1
    

    async def write_file(self, in_file, out_fname):
        # TODO: compression
        out_fpath = os.path.join(self.get_photos_dirpath(), out_fname)
        async with aiofiles.open(out_fpath, 'wb') as out_file:
            content = await in_file.read()
            await out_file.write(content)
    

    async def remove_file(self, fname):
        os.remove(os.path.join(self.get_photos_dirpath(), fname))
        self.photonames.remove(fname)
    

    @functools.lru_cache
    def get_url(self, url):
        purl = urllib.parse.urlparse(urllib.parse.unquote(url))
        if purl.hostname == "localhost" or purl.hostname == "127.0.0.1":
            purl = purl._replace(netloc=f"{socket.gethostname()}:{purl.port}")
        return purl.geturl()
    

    @functools.lru_cache
    def get_url_qrcode(self, url):
        qr = qrcode.QRCode()
        qr.add_data(self.get_url(url))
        qr.make(fit=True)
        img = qr.make_image()
        with io.BytesIO() as bio:
            img.save(bio, format="PNG")
            return bio.getvalue()