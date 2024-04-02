class SnapRect {
    constructor() {
        this.x1 = 0;
        this.y1 = 0;
        this.x2 = 0;
        this.y2 = 0;
        this.pageIndex = null;
        this.page = null;
    }

    get left()   { return Math.min(this.x1, this.x2); }
    get top()    { return Math.min(this.y1, this.y2); }
    get right()  { return Math.max(this.x1, this.x2); }
    get bottom() { return Math.max(this.y1, this.y2); }
    get width()  { return Math.abs(this.x2 - this.x1); }
    get height() { return Math.abs(this.y2 - this.y1); }
};
var snapRect = new SnapRect();
var snappping = false;


// Drag a snap box
function applySnapRectToMask(snapRect) {
    const masks = [0,1,2,3].map(maskId => document.getElementById(`snap-mask-${snapRect.pageIndex}-${maskId}`));
    const box = document.getElementById(`snap-box-${snapRect.pageIndex}`);
    
    const pageClientRect = snapRect.page.getBoundingClientRect();
    // 按象限顺序设置 mask 的位置
    masks[0].style.inset = `0px 0px ${pageClientRect.height - snapRect.top}px ${snapRect.left}px` // top right bottom left
    masks[1].style.inset = `0px ${pageClientRect.width - snapRect.left}px ${pageClientRect.height - snapRect.bottom}px 0px`
    masks[2].style.inset = `${snapRect.bottom}px ${pageClientRect.width - snapRect.right}px 0px 0px`
    masks[3].style.inset = `${snapRect.top}px 0px 0px ${snapRect.right}px`

    // 设置 snap box 的位置
    box.style.left = snapRect.left + 'px';
    box.style.top = snapRect.top + 'px';
    box.style.width = snapRect.width + 'px';
    box.style.height = snapRect.height + 'px';
}

function createMaskForPage(pageIndex, page) {
    function maskMouseDownHandler(e) {
        e = e || window.event;
        e.preventDefault();

        const pageClientRect = page.getBoundingClientRect();
        snapRect.x1 = e.clientX - pageClientRect.left;
        snapRect.y1 = e.clientY - pageClientRect.top;
        snapRect.pageIndex = pageIndex;
        snapRect.page = page;
    
        document.addEventListener('mousemove', maskMouseMoveHandler);
        document.addEventListener('mouseup', maskMouseUpHandler);
    }
    
    function maskMouseMoveHandler(e) {
        e = e || window.event;
        e.preventDefault();

        const pageClientRect = page.getBoundingClientRect();
        snapRect.x2 = e.clientX - pageClientRect.left;
        snapRect.y2 = e.clientY - pageClientRect.top;

        // 检查是否超出页面范围
        snapRect.x2 = Math.max(snapRect.x2, 0);
        snapRect.x2 = Math.min(snapRect.x2, pageClientRect.width);
        snapRect.y2 = Math.max(snapRect.y2, 0);
        snapRect.y2 = Math.min(snapRect.y2, pageClientRect.height);
        
        applySnapRectToMask(snapRect);
    }
    
    function maskMouseUpHandler() {
        document.removeEventListener('mousemove', maskMouseMoveHandler);
        document.removeEventListener('mouseup', maskMouseUpHandler);
        takeSvgSnap(current_doc, snapRect);
        clearMask();
    }

    for (let maskId=0; maskId<4; maskId++) {
        const maskDiv = document.createElement('div');
        maskDiv.className = 'snap-mask';
        maskDiv.id = `snap-mask-${pageIndex}-${maskId}`; // mask 编号按坐标系的象限顺序
        maskDiv.addEventListener('mousedown', maskMouseDownHandler);
        page.appendChild(maskDiv);
    }
    const boxDiv = document.createElement('div');
    boxDiv.className = 'snap-box';
    boxDiv.id = `snap-box-${pageIndex}`;
    page.appendChild(boxDiv);
}

function clearMask() {
    snappping = false;
    const masks = document.querySelectorAll('.snap-mask').forEach(e => e.remove());
    const boxes = document.querySelectorAll('.snap-box').forEach(e => e.remove());
}

function showMask() {
    snapRect = new SnapRect();
    snappping = true;
    const pages = document.querySelectorAll('div.page');
    for (let i=0; i<pages.length; i++) {
        createMaskForPage(i, pages[i]);

        // Reset mask position
        let tmpSnapRect = new SnapRect();
        tmpSnapRect.pageIndex = i;
        tmpSnapRect.page = pages[i];
        applySnapRectToMask(tmpSnapRect);
    }    
}

async function takeSvgSnap(doc_id, snapRect) {
    let pdfPageSize = await worker.getPageSize(doc_id, snapRect.pageIndex);
    let pdfSnapRect = {
        left: (snapRect.left / snapRect.page.clientWidth) * pdfPageSize.width,
        top: (snapRect.top / snapRect.page.clientHeight) * pdfPageSize.height,
        width: (snapRect.width / snapRect.page.clientWidth) * pdfPageSize.width,
        height: (snapRect.height / snapRect.page.clientHeight) * pdfPageSize.height,
        right: (snapRect.right / snapRect.page.clientWidth) * pdfPageSize.width,
        bottom: (snapRect.bottom / snapRect.page.clientHeight) * pdfPageSize.height,
    };

    let textOption = document.getElementById("text-option").value;
    let trimBox = {
        x0: pdfSnapRect.left, 
        y1: pdfPageSize.height - pdfSnapRect.top, // 坐标系不同，y轴需要反转
        x1: pdfSnapRect.right, 
        y0: pdfPageSize.height - pdfSnapRect.bottom // 坐标系不同，y轴需要反转
    };
    let doTrim = document.getElementById("trim-option").checked;
    let svg = await worker.saveToSvgBuffer(doc_id, snapRect.pageIndex, `text=${textOption}`, doTrim ? trimBox : null);

    svg = cropAndResizeSvg(svg, pdfSnapRect, snapRect.width, snapRect.height);
    // openSvgInNewTab(svg);
    // copySvgToClipboard(svg);
    pdfTitle = await worker.documentTitle(doc_id);
    dateTime = getFormattedTimestamp();
    downloadSvg(svg, `${pdfTitle}-${snapRect.pageIndex}-${dateTime}.svg`);
}
