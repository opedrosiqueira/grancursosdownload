async function callFunction(evt) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { fn: evt.target.id });
    console.log(response);
    window.close()
}

window.addEventListener('load', (event) => {
    document.getElementById('baixarAula').addEventListener('click', callFunction);
    document.getElementById('salvarProgresso').addEventListener('click', callFunction);
});