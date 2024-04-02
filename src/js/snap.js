"use strict"

// viewbox: crop 的矩形区域
// width、height: 最终svg展示的宽高
function cropAndResizeSvg(svg, viewBox, width, height) {
    const svgText = new TextDecoder("utf-8").decode(svg);

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = doc.querySelector("svg");

    if (!svgElement) throw new Error("Invalid SVG data");
    
    svgElement.setAttribute("width", width);
    svgElement.setAttribute("height", height);
    svgElement.setAttribute("viewBox", `${viewBox.left} ${viewBox.top} ${viewBox.width} ${viewBox.height}`);

    const serializedSVG = new XMLSerializer().serializeToString(svgElement);
    return new TextEncoder().encode(serializedSVG);
}

function openSvgInNewTab(svg) {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    window.open(`/svg-display.html?url=${encodeURIComponent(url)}`, "_blank");
}

// 目前不可行
async function copySvgToClipboard(svg) {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const clipboardItem = new ClipboardItem({ [`web ${blob.type}`]: blob });
    await navigator.clipboard.write([clipboardItem]);
}

function getFormattedTimestamp() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份是从0开始的
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

async function downloadSvg(svg, filename) {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const compressArrayBuffer = async (input) => {
    //create the stream
    const cs = new CompressionStream("gzip");
    //create the writer
    const writer = cs.writable.getWriter();
    //write the buffer to the writer 
    writer.write(input);
    writer.close();
    //create the output 
    const output = [];
    const reader = cs.readable.getReader();
    let totalSize = 0;
    //go through each chunk and add it to the output
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      output.push(value);
      totalSize += value.byteLength;
    }
    const concatenated = new Uint8Array(totalSize);
    let offset = 0;
    //finally build the compressed array and return it 
    for (const array of output) {
      concatenated.set(array, offset);
      offset += array.byteLength;
    }
    return concatenated;
};