async function downloadFile(url, filename) {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(blobUrl);
}

async function baixarVideo() {
    const page = document.querySelector('iframe').contentDocument
    const videoURL = page.querySelector("video").src.trim()
    const fileName = page.querySelector('h1').innerText.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-').trim()
    downloadFile(videoURL, fileName);
}

async function baixarMaterial(label, extensao = ".pdf") {
    for (el of document.querySelector('iframe').contentDocument.querySelectorAll("#lista-aulas > li")) {
        const filename = el.querySelector('span').innerText.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '-') + extensao
        const material = el.querySelector(`a[aria-label="${label}"`) ?? el.querySelector(`a[href^="/aluno/espaco/${label}"]`)
        if (material?.href) await chrome.runtime.sendMessage({ savepdf: { url: material.href, filename } })
    }
}

chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
        if (request.fn == 'baixarVideo') await baixarVideo()
        else if (request.fn == 'baixarSlides') {
            await baixarMaterial("Baixar slide da aula")
            await baixarMaterial("download-apostila")
        }
        else if (request.fn == 'baixarResumos') {
            await baixarMaterial("Material em PDF", " resumo.pdf")
            await baixarMaterial("Baixar aula degravada", " resumo.pdf")
            await baixarMaterial("download-resumo", " resumo.pdf")
        }
        sendResponse({ success: "TRUE" });
        return true;
    });
