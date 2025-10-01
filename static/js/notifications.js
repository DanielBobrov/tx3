class NotificationsManager {
    constructor() {
        let granted = false;
        // Check if the browser supports notifications
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications.");
            return;
        }
        Notification.requestPermission().then((permission) => {
            granted = permission === "granted";
        });
    }

    moveNotification(username) {
        console.log("NOTIFICATION", window.visible, document.hidden);
        if (!document.hidden) {
            const notification = new Notification("Кресты-обручи", {body: `${username} сделал ход`});
        }
    }
}


document.addEventListener("DOMContentLoaded", () => {
    var vis = (function () {
        var stateKey, eventKey, keys = {
            hidden: "visibilitychange",
            webkitHidden: "webkitvisibilitychange",
            mozHidden: "mozvisibilitychange",
            msHidden: "msvisibilitychange"
        };
        for (stateKey in keys) {
            if (stateKey in document) {
                eventKey = keys[stateKey];
                break;
            }
        }
        return function (c) {
            if (c) document.addEventListener(eventKey, c);
            return !document[stateKey];
        }
    })();
    window.visible = true;

    vis(function () {
        document.title = vis() ? window.visible = true : window.visible = false;
    });
    window.notificationsManager = new NotificationsManager();

});