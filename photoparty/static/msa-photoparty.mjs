export class HTMLMsaPhotoPartyElement extends HTMLElement {

	connectedCallback(){
		this.photo = null
		this.prevPhotos = []
		this.lastPhotoDate = 0
		this.initDom()
		this.initActions()
	}

	getMode(){
		let mode = this.getAttribute("mode")
		if(mode === "_url") mode = getUrlParam("mode")
		return mode || "home"
	}

	getHtml(){
		return `
			<style>
				:host {
					display: flex;
					padding: 0;
					margin: 0;
				}
				.fill {
					display: flex;
					flex: 1;
				}
				.btn {
					display: flex;
					flex-direction: row;
					align-items: center;
					justify-content: center;
					padding: .5em;
					margin: .5em;
					width: calc( 100% - 1em );
					font-size: 16px;
					background-image: linear-gradient(#42A1EC, #0070C9);
					border: 1px solid #0077CC;
					border-radius: 4px;
					cursor: pointer;
				}
				.btn:hover {
					box-shadow: 0 0 10px grey
				}
				.btn:focus {
					box-shadow: 0 0 10px grey
				}
				.btn i {
					display: inline-flex;
					width: 1em;
					height: 1em;
					background-size: contain;
					background-repeat: no-repeat;
					padding-right: .5em;
				}
				.btn span {
					color: white;
					font-weight: bold;
				}
				.btn.red {
					background-image: linear-gradient(#EE0000, #AA0000);
					border-color: #AA0000;
				}
				.btn.grey {
					background-image: linear-gradient(#EEEEEE, #AAAAAA);
					border-color: #AAAAAA;
				}
				.hide {
					opacity: 0;
					position: absolute;
					z-index: -1;
				}
			</style>
			<div id="home_wo_photo" class="fill">
				<img class="qrcode"/>
				<b class="url"></b>
			</div>
			<div id="home" class="fill" style="flex-direction: row;">
				<div id="photo" class="fill" style="background-size: contain; background-position: center; background-repeat: no-repeat;" ></div>
				<div style="padding: .5em; display: flex; width:200px; flex-direction:column; align-items: center;">
					<img class="qrcode" style="width:100%"/>
					<b class="url"></b>
					<!-- <button class="btn">
						<i style="background-image:url('/msa/photoparty/static/thumbsup.svg');"></i>
						<span>Like</span>
					</button> -->
					<button id="delete" class="btn red">
						<i style="background-image:url('/msa/photoparty/static/trash.svg');"></i>
						<span>Delete</span>
					</button>
				</div>
			</div>
			<div id="taker" class="fill" style="align-items: center; justify-content: center;">
				<label for="take" class="btn" style="width:50%; aspect-ratio: 1 / 1; border-radius:50%;">
					<i style="width:50%; height:50%; background-image:url('/msa/photoparty/static/camera.svg');"></i>
				</label>
				<input type="file" accept="image/*" multiple id="take" value="Take a photo" class="hide" />
			</div>
			<dialog id="confirm_delete">
				<form method="dialog" style="padding: .5em; display:flex; flex-direction: column; align-items: center; justify-content: center;">
					<p>Do you confirm deletion of this image ?</p>
					<img style="max-width:200px; max-height:200px" />
					<p style="display:flex; flex-direction: row;">
						<button class="yes btn red">
							<i style="background-image:url('/msa/photoparty/static/trash.svg');"></i>
							<span>Yes</span>
						</button>
						<button class="no btn grey">No</button>
					</p>
				</form>
			</dialog>
		`
	}

	initDom(){
		const shdw = this.attachShadow({ mode: 'open' })
		shdw.innerHTML = this.getHtml()
		this.syncDom()
	}

	syncDom(){
		const mode = this.getMode()
		this.Q("div#home_wo_photo").style.display = (mode === "home" && !this.photo) ? "" : "none"
		this.Q("div#home").style.display = (mode === "home" && this.photo) ? "" : "none"
		this.Q("div#taker").style.display = (mode === "taker") ? "" : "none"
		const qrcode_url_b64 = btoa(this.getQrcodeUrl())
		fetchJson(`/msa/photoparty/url/${qrcode_url_b64}`).then(res => {
			this.Qall(".url").forEach(u => u.textContent = res.url)
		})
		this.Qall("img.qrcode").forEach(i => i.src = `/msa/photoparty/qrcode/${qrcode_url_b64}`)
		this.Q("#delete").onclick = () => this.confirmDeleteCurrentPhoto()
	}

	getQrcodeUrl(){
		const url = new URL(window.location.href)
		const searchParams = url.searchParams
		searchParams.set('mode', 'taker')
		url.search = searchParams.toString()
		return url.toString()
	}

	initActions(){
		this.Q("input#take").oninput = evt => this.postPhotos(evt.target.files)
		//this.Q("input.view").onclick = () => this.setMode("viewer")
		this.tryFetchNextPhoto()
		setInterval(() => this.tryFetchNextPhoto(), 1000)
	}

	async tryFetchNextPhoto(){
		if(this.getMode() !== "home") return
		if(Date.now() < this.lastPhotoDate + 5000) return
		this.lastPhotoDate = Date.now()
		const res = await fetchJson("/msa/photoparty/next_photoname?" + new URLSearchParams({
			prev_photos: this.prevPhotos
		}))
		if(res) {
			this.photo = res.name
			this.prevPhotos.push(this.photo)
			while(this.prevPhotos.length > 10) this.prevPhotos.shift()
			this.Q("div#photo").style.backgroundImage = `url(/msa/photoparty/photo/${this.photo})`
			this.syncDom()
		}
	}

	postPhotos(photos){
		let formData = new FormData()
		for(let photo of photos)
			formData.append("photos", photo)
		fetch('/msa/photoparty/photos', {method: "POST", body: formData})
	}

	async confirmDeleteCurrentPhoto(){
		const photo = this.photo
		this.Q("#confirm_delete img").src = `/msa/photoparty/photo/${photo}`
		this.Q("#confirm_delete button.yes").onclick = () => this.deletePhoto(photo)
		this.Q("#confirm_delete").showModal()
	}

	async deletePhoto(photo){
		await fetch(`/msa/photoparty/_photo/${encodeURIComponent(photo)}`, { method: "DELETE" })
		this.tryFetchNextPhoto()
	}

	Q(query) {
		return this.shadowRoot.querySelector(query)
	}

	Qall(query) {
		return this.shadowRoot.querySelectorAll(query)
	}
}
customElements.define("msa-photoparty", HTMLMsaPhotoPartyElement)

// utils

function getUrlParam(key){
	const params = new URLSearchParams(window.location.search)
	return params.get(key)
}

function setUrlParam(key, val) {
	const params = new URLSearchParams(window.location.search)
	params.set(key, val)
	const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + params.toString()
	window.history.pushState({path:newUrl},'',newUrl)
}

async function fetchJson(url, args) {
    // if(args && args.json){
    //     args.headers = args.headers || {}
    //     args.headers['Content-Type'] = 'application/json'
    //     args.body = JSON.stringify(args.json)
    //     delete args.json
    // }
	const res = await fetch(url, args)
	if(res.status < 300)
		return await res.json()
}