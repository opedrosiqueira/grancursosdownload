chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (sender.tab && request.savepdf) {
            chrome.downloads.download({
                url: request.savepdf.url,
                filename: request.savepdf.filename
            });
        }
    }
);
