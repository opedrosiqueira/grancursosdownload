async function callFunction(evt) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { fn: evt.target.id });
    console.log(response);
    window.close()
}

window.addEventListener('load', (event) => {
    document.getElementById('baixarVideo').addEventListener('click', callFunction);
    document.getElementById('baixarSlides').addEventListener('click', callFunction);
    document.getElementById('baixarResumos').addEventListener('click', callFunction);
});