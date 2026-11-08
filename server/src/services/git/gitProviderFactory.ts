import type { GitProviderAdapter } from './GitProviderAdapter.js';
import { GitHubAdapter } from './GitHubAdapter.js';
import { GitLabAdapter } from './GitLabAdapter.js';
import type { GitProviderType } from './git.types.js';

const githubAdapterInstance = new GitHubAdapter();
const gitlabAdapterInstance = new GitLabAdapter();

export function getGitProviderAdapter(provider: GitProviderType | string): GitProviderAdapter {
  if (provider.toLowerCase() === 'gitlab') {
    return gitlabAdapterInstance;
  }
  return githubAdapterInstance;
}

