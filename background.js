chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (!chrome.sidePanel || !tab || tab.id == null) {
    return;
  }
  chrome.sidePanel.open({ tabId: tab.id });
});
