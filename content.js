(async function () {
    'use strict';

    const UTILS = {

        addStyle: function (css) {
            const style = document.getElementById("GM_addStyleBy3333") || (function () {
                const style = document.createElement('style');
                style.id = "GM_addStyleBy3333";
                style.type = 'text/css';
                document.head.appendChild(style);
                return style;
            })();
            style.innerHTML += css;
        },

        extractAttrs(element) {
            return [...element.attributes].reduce((attrs, attr) => {
                attrs[attr.name] = attr.value;
                return attrs;
            }, {});
        },

        extractJsonAttrData(el, attr) {
            const element = el.hasAttribute(attr) ? el : el.querySelector(`[${attr}]`);
            return JSON.parse(element.getAttribute(attr));
        },

        randString(len) {
            let result = '';
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const charsLength = chars.length;
            for (let i = 0; i < len; i++) result += chars[Math.floor(Math.random() * charsLength)];
            return result;
        },

        async waitForElement(selector, timeout = CONFIG.TIMEOUTS.ELEMENT_WAIT, visible = true) {
            let stopLooking = false;
            const timeoutPromise = new Promise(resolve => setTimeout(() => {
                stopLooking = true;
                resolve(null);
            }, timeout));
            const pollPromise = (async () => {
                while (!stopLooking) {
                    const element = document.querySelector(selector);
                    if (element && (!visible || this.isVisible(element))) return element;
                    await this.sleep(10);
                }
            })();
            return Promise.race([pollPromise, timeoutPromise]);
        },

        isVisible(element) {
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0; // && rect.x >= 0 && rect.y >= 0
        },

        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        click(element) {
            if (!element) return;
            ['mousedown', 'click', 'mouseup'].forEach(eventType => {
                element.dispatchEvent(new MouseEvent(eventType, { view: window, bubbles: true, cancelable: true, buttons: 1 }));
            });
        },

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };

    UTILS.addStyle(`
      @media (max-width: 900px) {

        .wam-chats-list { position: fixed; width: 400px; max-width: 400px!important; left: -385px; top: 60px; bottom: 30px; border-radius: 0 30px 30px 0; height: auto; z-index: 900; flex: 0; opacity: 0; overflow: hidden }
        .wam-chats-list:hover { left: 0; opacity: 1; box-shadow: 0 0 50px #00000055; }

        .wam-chats-nav {min-width: 100%!important}
        .wam-chats-nav hr {display: none}
        .wam-chats-nav > header { position: fixed; top: 0; left: 0; width: 100%; height: auto; padding: 0 10px }
        .wam-chats-nav > header > div { display: flex; flex-direction: row; justify-content: space-between; }
        .wam-chats-nav > header > div > div { width: auto }
        .wam-chats-nav > header > div > div > div { display: flex; flex-direction: row; align-items: center; justify-content: space-between }
        .wam-chats-nav > header > div > div > div > div { width: 40px; min-width: 40px }

        .wam-chats-nav > div:not(.wam-chats-list) { margin: 0 !important; position: absolute; top: 0; left: 0; right: 0; bottom: 0; height: auto; max-width: 100vw; }
        .wam-chats-nav > div:not(.wam-chats-list) > div { margin: 0 0 0 0 !important; }
        .wam-chats-nav > div:not(.wam-chats-list):last-child { display: none }

        .wa-chat-icon span[aria-label] { position: relative; z-index: 1; animation: notif 3s infinite ease-in-out; pointer-events: none }
        @keyframes notif { 
           0%, 100% { box-shadow: 0 0 200px 0 #21C06300; } 
           90% { box-shadow: 0 0 200px 500px #21C063AA; } 
           99% { box-shadow: 0 0 200px 500px #21C06300; } 
        }

        /* single chat header */
        #main header { margin: 44px 0 0 0; }

        /* less padding on messages */
        .message-in, .message-out { padding: 0 20px!important}

        .wam-sidebar {position: fixed; top: 40px; width: 100%; bottom: 0; max-width: 100%;}
      }
    `);

    function addClasses() {
        try { document.querySelectorAll('header')[0].parentNode.classList.add('wam-chats-nav') } catch (err) { console.error(err) }
        try { document.querySelectorAll('header')[1].parentNode.classList.add('wam-chats-list') } catch (err) { console.error(err) }
        try { document.querySelectorAll('header')[3].parentNode.classList.add('wam-chats-main') } catch (err) { console.error(err) }
        try { document.querySelectorAll('header')[0].nextSibling.style.display = 'none' } catch (err) { console.error(err) }

        // hide other non chat sections, it contains settings etc
        try { 
            document.querySelectorAll('header')[0].nextSibling.nextSibling.classList.add('wam-sidebar-and-info'); 
            document.querySelectorAll('header')[0].nextSibling.nextSibling.children[0].classList.add('wam-sidebar'); 
            // document.querySelectorAll('header')[0].nextSibling.nextSibling.style.display = 'none' 
        } catch (err) { console.error(err) }

        try { document.querySelectorAll('header')[0].parentNode.style.minWidth = '100vw'; } catch (err) { console.error(err) }
        try { document.querySelector('[data-icon="chat-filled-refreshed"]').parentElement.parentElement.parentElement.parentElement.classList.add('wa-chat-icon') } catch (err) { console.error(err) }
    }

    await UTILS.waitForElement('[data-icon="chat-filled-refreshed"]', 10_000);
    addClasses();

})();