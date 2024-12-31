chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (sender.tab && request.savepdf) {
            chrome.downloads.download({
                url: request.savepdf.url
            }).then(async (downloadId) => {
                const results = await chrome.downloads.search({ id: downloadId });
                if (results && results.length > 0) {
                    const downloadItem = results[0];
                    sendResponse({ filename: downloadItem.filename.split('/').pop() })
                } else {
                    sendResponse({ filename: null });
                }

            });
        }
        return true;
    }
);
