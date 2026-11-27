import { pathToFileURL } from 'node:url';

const api = 'https://api.github.com/repos/I-CORE-TEC/plexo';
const query = new URLSearchParams({ state: 'open', head: 'I-CORE-TEC:qa', base: 'agc' });

export async function reconcilePromotion(fetch, token) {
  if (!token) throw new Error('GitHub token is required');
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: 'Bearer ' + token,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const request = (path, options = {}) => fetch(api + path, { headers, ...options });
  const list = async () => {
    const response = await request('/pulls?' + query);
    if (!response.ok) throw new Error('List promotion PRs failed: HTTP ' + response.status);
    return (await response.json())[0]?.html_url;
  };

  const existing = await list();
  if (existing) return existing;

  const comparison = await request('/compare/agc...qa?per_page=1');
  if (!comparison.ok) throw new Error('Compare branches failed: HTTP ' + comparison.status);
  if ((await comparison.json()).ahead_by === 0) return null;

  const response = await request('/pulls', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      head: 'qa',
      base: 'agc',
      title: 'Promote QA to AGC',
      body: 'This pull request tracks the canonical QA branch. Review the changes and wait for CI and both mandatory Railway QA deployments before merging. This workflow does not merge the PR.',
    }),
  });
  if (response.ok) return (await response.json()).html_url;
  if (response.status === 422) {
    const concurrent = await list();
    if (concurrent) return concurrent;
  }
  throw new Error('Create promotion PR failed: HTTP ' + response.status);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = await reconcilePromotion(fetch, process.env.GH_TOKEN);
  console.log(url ? 'AGC promotion PR: ' + url : 'No commits to promote from QA.');
}