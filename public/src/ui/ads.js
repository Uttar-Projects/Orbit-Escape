/**
 * ui/ads.js
 * =========
 * Ad broker lifecycle manager.
 *
 * Adsgram SDK is loaded on demand (not in index.html) so Telegram boot is not blocked.
 *
 * The AdBroker.show() contract:
 *   Resolves →  { done: true }             — user watched the full ad, grant reward
 *   Rejects  →  { skipped: true }          — user skipped, no reward
 *   Rejects  →  { error: true, msg: '…' }  — network/SDK failure, no reward
 */

let _adsgramLoad = null;

function loadAdsgramSdk() {
    if (window.Adsgram) return Promise.resolve();
    if (_adsgramLoad) return _adsgramLoad;
    _adsgramLoad = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://sad.adsgram.ai/js/sad.min.js';
        s.async = true;
        const t = setTimeout(() => reject(new Error('Adsgram SDK timeout')), 12000);
        s.onload = () => { clearTimeout(t); resolve(); };
        s.onerror = () => { clearTimeout(t); reject(new Error('Adsgram SDK failed to load')); };
        document.head.appendChild(s);
    }).catch(err => { _adsgramLoad = null; throw err; });
    return _adsgramLoad;
}

export const AdBroker = {
    /**
     * Show a rewarded ad.
     * @returns {Promise<{ done: boolean }>}
     */
    async show() {
        const blockId = window.__ADSGRAM_BLOCK_ID__;
        if (blockId) {
            try {
                await loadAdsgramSdk();
                if (window.Adsgram) {
                    return new Promise((resolve, reject) => {
                        const AdController = window.Adsgram.init({ blockId });
                        AdController.show()
                            .then(result => {
                                if (result.done) resolve({ done: true });
                                else reject({ skipped: true, done: false });
                            })
                            .catch(err => reject({ error: true, done: false, msg: err?.message || 'Ad failed' }));
                    });
                }
            } catch (err) {
                console.warn('[Adsgram]', err.message);
            }
        }
        return this._stub();
    },

    /**
     * Simulates the full ad lifecycle for development / testing.
     * Renders a visible overlay so the UI flow can be validated without
     * a real ad network account.
     */
    _stub() {
        const AD_DURATION    = 5000;  // ms
        const SKIP_AFTER     = 3000;  // ms — skip button unlocks here

        return new Promise((resolve, reject) => {
            const overlay      = document.getElementById('ad-overlay');
            const titleEl      = overlay.querySelector('h1');
            const timerEl      = document.getElementById('ad-timer');
            const statusEl     = document.getElementById('ad-status');
            const progressFill = document.getElementById('ad-progress-fill');
            const skipBtn      = document.getElementById('ad-skip-btn');

            let elapsed = 0;
            let ticker  = null;
            let done    = false;

            function cleanup() {
                clearInterval(ticker);
                overlay.style.display = 'none';
                skipBtn.onclick = null;
            }

            skipBtn.disabled  = true;
            skipBtn.textContent = 'Please wait...';
            overlay.style.display = 'flex';

            skipBtn.onclick = () => {
                if (skipBtn.disabled) return;
                done = true;
                cleanup();
                reject({ skipped: true, done: false });
            };

            // Phase 1 — Loading
            titleEl.textContent  = '📡 AD LOADING';
            statusEl.textContent = 'Connecting to ad network...';
            timerEl.textContent  = '…';
            progressFill.style.width = '0%';

            setTimeout(() => {
                if (done) return;

                // Phase 2 — Playing
                titleEl.textContent  = '📺 AD PLAYING';
                statusEl.textContent = "Watch the full ad to earn your revive! 👀";

                ticker = setInterval(() => {
                    elapsed += 100;
                    const pct       = Math.min((elapsed / AD_DURATION) * 100, 100);
                    const remaining = Math.ceil((AD_DURATION - elapsed) / 1000);

                    progressFill.style.width = `${pct}%`;
                    timerEl.textContent      = remaining > 0 ? String(remaining) : '✓';

                    if (elapsed >= SKIP_AFTER && skipBtn.disabled) {
                        skipBtn.disabled    = false;
                        skipBtn.textContent = 'SKIP AD';
                    }

                    if (elapsed >= AD_DURATION) {
                        done = true;
                        clearInterval(ticker);

                        // Phase 3 — Complete
                        titleEl.textContent  = '✅ AD COMPLETE';
                        statusEl.textContent = 'Revive unlocked!';

                        setTimeout(() => {
                            cleanup();
                            resolve({ done: true });
                        }, 600);
                    }
                }, 100);

            }, 1500);
        });
    }
};
