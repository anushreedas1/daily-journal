import { useEffect, useState } from 'react';

export default function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setInstalled(Boolean(standalone));

    function rememberPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    function rememberInstall() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener('beforeinstallprompt', rememberPrompt);
    window.addEventListener('appinstalled', rememberInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', rememberPrompt);
      window.removeEventListener('appinstalled', rememberInstall);
    };
  }, []);

  if (installed) return null;

  async function handleInstall() {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice?.outcome === 'accepted') setInstalled(true);
  }

  return (
    <>
      <div className="install-app-prompt">
        <div>
          <strong>Take your journal with you</strong>
          <span>Install it on your phone for quick access.</span>
        </div>
        <button type="button" onClick={handleInstall}>Install mobile app</button>
      </div>
      {showHelp && (
        <div className="install-help-backdrop" onClick={() => setShowHelp(false)}>
          <section className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-help-title" onClick={(event) => event.stopPropagation()}>
            <button className="install-help-close" type="button" aria-label="Close" onClick={() => setShowHelp(false)}>×</button>
            <h2 id="install-help-title">Add Daily Journal to your phone</h2>
            <p><strong>Samsung Internet:</strong> Tap the menu (☰), then <em>+ Add page to</em> → <em>Home screen</em>.</p>
            <p><strong>Chrome on Android:</strong> Tap ⋮, then <em>Install app</em> or <em>Add to home screen</em>.</p>
            <p>On iPhone, open this page in Safari, tap Share, then <em>Add to Home Screen</em>.</p>
            <button type="button" onClick={() => setShowHelp(false)}>Got it</button>
          </section>
        </div>
      )}
    </>
  );
}
