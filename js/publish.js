// Editor-only: publishing. Either download the files and upload them yourself, or let
// the editor commit them to your GitHub repo through the GitHub REST API.
(function (root) {
  'use strict';

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000; // keep String.fromCharCode's argument list small
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(binary);
  }

  async function blobToBase64(blob) {
    return bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  }

  function explain(status, path, body) {
    const detail = body && body.message ? ' (GitHub says: ' + body.message + ')' : '';
    if (status === 401) return 'GitHub rejected the token. Check that it is pasted correctly and has not expired.' + detail;
    if (status === 403) return 'The token is not allowed to write to this repo. Give it "Contents: Read and write" for this repository.' + detail;
    if (status === 404) return 'Repo or branch not found, or the token cannot see it. Check owner, repo and branch.' + detail;
    if (status === 409) return 'GitHub reported a conflict on ' + path + '. Try Publish again.' + detail;
    if (status === 422) return 'GitHub refused ' + path + '. The file may be too large.' + detail;
    return 'GitHub returned ' + status + ' for ' + path + '.' + detail;
  }

  // Commits each file with the Contents API (one commit per file keeps the code simple).
  // files: [{ path, blob }] uploaded first, then the content file last, so the live site
  // never points at media that is not there yet.
  async function publishToGitHub(settings, contentText, files, log) {
    const owner = settings.owner.trim();
    const repo = settings.repo.trim();
    const branch = (settings.branch || 'main').trim();
    if (!owner || !repo) throw new Error('Fill in the GitHub owner and repo name first.');
    if (!settings.token) throw new Error('Paste a GitHub token first.');

    const base = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo) + '/contents/';
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + settings.token.trim(),
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const urlFor = (path) => base + path.split('/').map(encodeURIComponent).join('/');

    async function currentSha(path) {
      const res = await fetch(urlFor(path) + '?ref=' + encodeURIComponent(branch), { headers, cache: 'no-store' });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(explain(res.status, path, await res.json().catch(() => null)));
      return (await res.json()).sha || null;
    }

    async function putFile(path, base64, message) {
      const sha = await currentSha(path);
      const body = { message, content: base64, branch };
      if (sha) body.sha = sha;
      const res = await fetch(urlFor(path), { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(explain(res.status, path, await res.json().catch(() => null)));
    }

    // Fail early with a clear message if the repo or token is wrong.
    const check = await fetch('https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo), { headers });
    if (!check.ok) throw new Error(explain(check.status, owner + '/' + repo, await check.json().catch(() => null)));
    const info = await check.json();
    if (info.permissions && !info.permissions.push) throw new Error(explain(403, owner + '/' + repo));

    for (const file of files) {
      log('Uploading ' + file.path + ' (' + Math.ceil(file.blob.size / 1024) + ' KB)…');
      await putFile(file.path, await blobToBase64(file.blob), 'Add ' + file.path);
    }
    log('Saving data/portfolio.js…');
    await putFile('data/portfolio.js', bytesToBase64(new TextEncoder().encode(contentText)), 'Update portfolio content');
    log('Done. GitHub Pages usually shows the change within a minute or two.');
    return 'https://github.com/' + owner + '/' + repo + '/commits/' + encodeURIComponent(branch);
  }

  root.PF = Object.assign(root.PF || {}, { publish: { downloadBlob, publishToGitHub } });
})(window);
