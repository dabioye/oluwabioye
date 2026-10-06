// Runs while the page is still loading so the envelope covers the page before it paints (no flash).
// Skipped when this envelope was already opened during this visit. Place right after <Intro>.
export function IntroBoot({ storageKey }: { storageKey: string }) {
  const js = `(function(){try{var i=document.getElementById('intro');if(!i||sessionStorage.getItem('opened:${storageKey}'))return;i.hidden=false;document.documentElement.classList.add('intro-on')}catch(e){}})()`;
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
