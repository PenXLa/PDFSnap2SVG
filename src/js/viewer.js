"use strict"

// FAST SORTED ARRAY FUNCTIONS

function array_remove(array, index) {
	let n = array.length
	for (let i = index + 1; i < n; ++i)
		array[i - 1] = array[i]
	array.length = n - 1
}

function array_insert(array, index, item) {
	for (let i = array.length; i > index; --i)
		array[i] = array[i - 1]
	array[index] = item
}

function set_has(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return true
	}
	return false
}

function set_add(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else
			return
	}
	array_insert(set, a, item)
}

function set_delete(set, item) {
	let a = 0
	let b = set.length - 1
	while (a <= b) {
		let m = (a + b) >> 1
		let x = set[m]
		if (item < x)
			b = m - 1
		else if (item > x)
			a = m + 1
		else {
			array_remove(set, m)
			return
		}
	}
}

// LOADING AND ERROR MESSAGES

function show_message(msg) {
	console.log(msg)
}

function clear_message() {
	// do nothing
}

// BACKGROUND WORKER

const worker = new Worker("js/worker.js", { type: "module" })

worker._promise_id = 1
worker._promise_map = new Map()

worker.wrap = function (name) {
	return function (...args) {
		return new Promise(function (resolve, reject) {
			let id = worker._promise_id++
			worker._promise_map.set(id, { resolve, reject })
			if (args[0] instanceof ArrayBuffer)
				worker.postMessage([ name, id, args ], [ args[0] ])
			else
				worker.postMessage([ name, id, args ])
		})
	}
}

worker.onmessage = function (event) {
	let [ type, id, result ] = event.data
	let error

	switch (type) {
	case "INIT":
		for (let method of result)
			worker[method] = worker.wrap(method)
		main()
		break

	case "RESULT":
		worker._promise_map.get(id).resolve(result)
		worker._promise_map.delete(id)
		break

	case "ERROR":
		error = new Error(result.message)
		error.name = result.name
		error.stack = result.stack
		worker._promise_map.get(id).reject(error)
		worker._promise_map.delete(id)
		break

	default:
		error = new Error(`Invalid message: ${type}`)
		worker._promise_map.get(id).reject(error)
		break
	}
}

// PAGE VIEW

class PageView {
	constructor(doc, pageNumber, defaultSize, zoom) {
		this.doc = doc
		this.pageNumber = pageNumber // 0-based
		this.size = defaultSize

		this.loadPromise = false
		this.drawPromise = false

		this.rootNode = document.createElement("div")
		this.rootNode.id = "page" + (pageNumber + 1)
		this.rootNode.className = "page"
		this.rootNode.page = this

		this.canvasNode = document.createElement("canvas")
		this.canvasCtx = this.canvasNode.getContext("2d")
		this.rootNode.appendChild(this.canvasNode)

		this.textData = null
		this.textNode = document.createElement("div")
		this.textNode.className = "text"
		this.rootNode.appendChild(this.textNode)

		this.linkData = null
		this.linkNode = document.createElement("div")
		this.linkNode.className = "link"
		this.rootNode.appendChild(this.linkNode)

		this.needle = null
		this.loadNeedle = null
		this.showNeedle = null

		this.zoom = zoom
		this._updateSize()
	}

	// Update page element size for current zoom level.
	_updateSize() {
		// We use the `foo | 0` notation to round down floating point numbers to integers.
		// This matches the conversion done in `mupdf.js` when `Pixmap.withBbox`
		// calls `libmupdf._wasm_new_pixmap_with_bbox`.
		this.rootNode.style.width = (((this.size.width * this.zoom) / 72) | 0) + "px"
		this.rootNode.style.height = (((this.size.height * this.zoom) / 72) | 0) + "px"
		this.canvasNode.style.width = (((this.size.width * this.zoom) / 72) | 0) + "px"
		this.canvasNode.style.height = (((this.size.height * this.zoom) / 72) | 0) + "px"
	}

	setZoom(zoom) {
		if (this.zoom !== zoom) {
			this.zoom = zoom
			this._updateSize()
		}
	}

	async _load() {
		console.log("LOADING", this.pageNumber)

		this.size = await worker.getPageSize(this.doc, this.pageNumber)
		this.textData = await worker.getPageText(this.doc, this.pageNumber)
		this.linkData = await worker.getPageLinks(this.doc, this.pageNumber)

		this._updateSize()
	}

	async _show() {
		if (!this.loadPromise)
			this.loadPromise = this._load()
		await this.loadPromise

		// Render image if zoom factor has changed!
		if (this.canvasNode.zoom !== this.zoom)
			this._render()

		// (Re-)create HTML nodes if zoom factor has changed
		if (this.textNode.zoom !== this.zoom)
			this._showText()

		// (Re-)create HTML nodes if zoom factor has changed
		if (this.linkNode.zoom !== this.zoom)
			this._showLinks()
	}

	async _render() {
		// Remember zoom value when we start rendering.
		let zoom = this.zoom

		// If the current image node was rendered with the same arguments we skip the render.
		if (this.canvasNode.zoom === this.zoom)
			return

		if (this.drawPromise) {
			// If a render is ongoing, don't queue a new render immediately!
			// When the on-going render finishes, we check the page zoom value.
			// If it is stale, we immediately queue a new render.
			console.log("BUSY DRAWING", this.pageNumber)
			return
		}

		console.log("DRAWING", this.pageNumber, zoom)

		this.canvasNode.zoom = this.zoom

		this.drawPromise = worker.drawPageAsPixmap(this.doc, this.pageNumber, zoom * devicePixelRatio)

		let imageData = await this.drawPromise
		if (imageData == null)
			return

		this.drawPromise = null

		if (this.zoom === zoom) {
			// Render is still valid. Use it!
			console.log("FRESH IMAGE", this.pageNumber)
			this.canvasNode.width = imageData.width
			this.canvasNode.height = imageData.height
			this.canvasCtx.putImageData(imageData, 0, 0)
		} else {
			// Uh-oh. This render is already stale. Try again!
			console.log("STALE IMAGE", this.pageNumber)
			if (set_has(page_visible, this.pageNumber))
				this._render()
		}
	}

	_showText() {
		this.textNode.zoom = this.zoom
		this.textNode.replaceChildren()

		let nodes = []
		let pdf_w = []
		let html_w = []
		let text_len = []
		let scale = this.zoom / 72

		for (let block of this.textData.blocks) {
			if (block.type === "text") {
				for (let line of block.lines) {
					let text = document.createElement("span")
					text.style.left = line.bbox.x * scale + "px"
					text.style.top = (line.y - line.font.size * 0.8) * scale + "px"
					text.style.height = line.bbox.h * scale + "px"
					text.style.fontSize = line.font.size * scale + "px"
					text.style.fontFamily = line.font.family
					text.style.fontWeight = line.font.weight
					text.style.fontStyle = line.font.style
					text.textContent = line.text
					this.textNode.appendChild(text)
					nodes.push(text)
					pdf_w.push(line.bbox.w * scale)
					text_len.push(line.text.length - 1)
				}
			}
		}

		for (let i = 0; i < nodes.length; ++i) {
			if (text_len[i] > 0)
				html_w[i] = nodes[i].clientWidth
		}

		for (let i = 0; i < nodes.length; ++i) {
			if (text_len[i] > 0)
				nodes[i].style.letterSpacing = (pdf_w[i] - html_w[i]) / text_len[i] + "px"
		}
	}

	_showLinks() {
		this.linkNode.zoom = this.zoom
		this.linkNode.replaceChildren()

		let scale = this.zoom / 72
		for (let link of this.linkData) {
			let a = document.createElement("a")
			a.href = link.href
			a.style.left = link.x * scale + "px"
			a.style.top = link.y * scale + "px"
			a.style.width = link.w * scale + "px"
			a.style.height = link.h * scale + "px"
			this.linkNode.appendChild(a)
		}
	}
}

// DOCUMENT VIEW

var current_doc = 0
var current_zoom = 96

var page_list = null // all pages in document

// Track page visibility as the user scrolls through the document.
// When a page comes near the viewport, we add it to the list of
// "visible" pages and queue up rendering it.
var page_visible = []
var page_observer = new IntersectionObserver(
	function (entries) {
		for (let entry of entries) {
			let page = entry.target.page
			if (entry.isIntersecting)
				set_add(page_visible, page.pageNumber)
			else
				set_delete(page_visible, page.pageNumber)
		}
		queue_update_view()
	},
	{
		// This means we have 3 viewports of vertical "head start" where
		// the page is rendered before it becomes visible.
		root: document.getElementById("page-panel"),
		rootMargin: "25% 0px 300% 0px",
	}
)


// Timer that waits until things settle before kicking off rendering.
var update_view_timer = 0
function queue_update_view() {
	if (update_view_timer)
		clearTimeout(update_view_timer)
	update_view_timer = setTimeout(update_view, 50)
}

function update_view() {
	if (update_view_timer)
		clearTimeout(update_view_timer)
	update_view_timer = 0

	for (let i of page_visible)
		page_list[i]._show()
}

function find_visible_page() {
	let panel = document.getElementById("page-panel").getBoundingClientRect()
	let panel_mid = (panel.top + panel.bottom) / 2
	for (let p of page_visible) {
		let rect = page_list[p].rootNode.getBoundingClientRect()
		if (rect.top <= panel_mid && rect.bottom >= panel_mid)
			return p
	}
	return page_visible[0]
}

function zoom_in() {
	zoom_to(Math.min(current_zoom + 12, 384))
}

function zoom_out() {
	zoom_to(Math.max(current_zoom - 12, 48))
}

function zoom_to(new_zoom) {
	if (current_zoom === new_zoom)
		return
	current_zoom = new_zoom

	// TODO: keep page coord at center of cursor in place when zooming

	let p = find_visible_page()

	for (let page of page_list)
		page.setZoom(current_zoom)

	page_list[p].rootNode.scrollIntoView()

	queue_update_view()
}

// KEY BINDINGS & MOUSE WHEEL ZOOM

window.addEventListener("wheel",
	function (event) {
		// Intercept Ctl+MOUSEWHEEL that change browser zoom.
		// Our page rendering requires a 1-to-1 pixel scale.
		if (event.ctrlKey || event.metaKey) {
			if (event.deltaY < 0)
				zoom_in()
			else if (event.deltaY > 0)
				zoom_out()
			event.preventDefault()
		}
	},
	{ passive: false }
)

window.addEventListener("keydown", function (event) {
	// Intercept and override some keyboard shortcuts.
	// We must override the Ctl-PLUS and Ctl-MINUS shortcuts that change browser zoom.
	// Our page rendering requires a 1-to-1 pixel scale.
	if (event.ctrlKey || event.metaKey) {
		switch (event.keyCode) {
		// '=' / '+' on various keyboards
		case 61:
		case 107:
		case 187:
		case 171:
			zoom_in()
			event.preventDefault()
			break
		// '-'
		case 173:
		case 109:
		case 189:
			zoom_out()
			event.preventDefault()
			break
		// '0'
		case 48:
		case 96:
			zoom_to(100)
			break
		}
	}
})

function toggle_fullscreen() {
	// Safari on iPhone doesn't support Fullscreen
	if (typeof document.documentElement.requestFullscreen !== "function")
		return
	if (document.fullscreenElement)
		document.exitFullscreen()
	else
		document.documentElement.requestFullscreen()
}

// OUTLINE

function build_outline(parent, outline) {
	for (let item of outline) {
		let node = document.createElement("li")
		let a = document.createElement("a")
		a.href = "#page" + (item.page + 1)
		a.textContent = item.title
		node.appendChild(a)
		if (item.down) {
			let down = document.createElement("ul")
			build_outline(down, item.down)
			node.appendChild(down)
		}
		parent.appendChild(node)
	}
}

function toggle_outline_panel() {
	if (document.getElementById("outline-panel").style.display === "none")
		show_outline_panel()
	else
		hide_outline_panel()
}

function show_outline_panel() {
	if (!page_list)
		return
	document.getElementById("outline-panel").style.display = "block"
}

function hide_outline_panel() {
	document.getElementById("outline-panel").style.display = "none"
}

// DOCUMENT LOADING

function close_document() {
	clear_message()
	hide_outline_panel()

	if (current_doc) {
		worker.closeDocument(current_doc)
		current_doc = 0
		document.getElementById("outline").replaceChildren()
		document.getElementById("pages").replaceChildren()
		for (let page of page_list)
			page_observer.unobserve(page.rootNode)
		page_visible.length = 0
	}

	page_list = null
}

async function open_document_from_buffer(buffer, magic, title) {
	current_doc = await worker.openDocumentFromBuffer(buffer, magic)

	document.getElementById("pdf-title").innerText = await worker.documentTitle(current_doc) || title

	var page_count = await worker.countPages(current_doc)

	// Use second page as default page size (the cover page is often differently sized)
	var page_size = await worker.getPageSize(current_doc, page_count > 1 ? 2 : 1)

	page_list = []
	for (let i = 0; i < page_count; ++i)
		page_list[i] = new PageView(current_doc, i, page_size, current_zoom)

	for (let page of page_list) {
		document.getElementById("pages").appendChild(page.rootNode)
		page_observer.observe(page.rootNode)
	}

	var outline = await worker.documentOutline(current_doc)
	if (outline) {
		build_outline(document.getElementById("outline"), outline)
		show_outline_panel()
	} else {
		hide_outline_panel()
	}

	clear_message()
}

async function open_document_from_file(file) {
	if (!file) return;
	close_document()
	try {
		show_message("Loading " + file.name)
		history.replaceState(null, null, window.location.pathname)
		await open_document_from_buffer(await file.arrayBuffer(), file.name, file.name)
	} catch (error) {
		show_message(error.name + ": " + error.message)
		console.error(error)
	}
}

async function open_document_from_url(path) {
	close_document()
	try {
		show_message("Loading " + path)
		let response = await fetch(path)
		if (!response.ok)
			throw new Error("Could not fetch document.")
		await open_document_from_buffer(await response.arrayBuffer(), path, path)
	} catch (error) {
		show_message(error.name + ": " + error.message)
		console.error(error)
	}
}

function main() {
	clear_message()
	let params = new URLSearchParams(window.location.search)
	if (params.has("file"))
		open_document_from_url(params.get("file"))
}
