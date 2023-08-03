import axios from 'axios';

export const BASE_URL = 'https://api.github.com';

export type GithubBlob = {
  content: string;
  encoding: 'base64';
  url: string;
  sha: string;
  size: number;
};

export type GithubTreeNode = {
  path: string;
  mode: string;
  type: string;
  size: number;
  sha: string;
  url: string;
};

export type GithubTree = {
  sha: string;
  url: string;
  tree: GithubTreeNode[];
};

export type GithubRepo = {
  name: string;
  full_name: string;
  default_branch: string;
};

export type GithubCommit = {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: {
      sha: string;
      url: string;
    };
    url: string;
  };
  url: string;
};

export type GithubBranch = {
  name: string;
  commit: GithubCommit;
};

export interface ModelContentType {
  path: string;
  url: string;
  sha: string;
  size: number;
  repo: string;
  branch: string;
}

export interface RepoNode {
  children?: RepoNode[];
  id: string;
  name: string;
  type: 'blob' | 'tree' | 'repo' | 'org';
  path: string;
  icon?: string;
  img?: string;
  sha: string;
  selectable?: boolean;
  expandable?: boolean;
}

export interface Repository {
  repo: string;
  branch?: string;
  repr: string;
  path: string;
}

export interface OrgRepoNode extends CollectionRepoNode {
  org: string;
}

export interface CollectionRepoNode extends RepoNode {
  uploadTo?: string;
  repositories: Repository[];
  lazy?: string | boolean;
}

export interface BlobRepoNode extends RepoNode {
  meta: { [key: string]: unknown };
  content_types?: {
    f3d?: ModelContentType;
    step?: ModelContentType;
    dxf?: ModelContentType;
    svg?: ModelContentType;
    meta?: ModelContentType;
    thumb?: ModelContentType;
  };
}

export interface RepoDBCache {
  clear(): Promise<void>;
  set(key: string, value: any): Promise<void>;
  get(key: string, defaultValue?: any): Promise<any>;
}

class InMemCache implements RepoDBCache {
  data: { [key: string]: string };
  constructor() {
    this.data = {};
  }
  async get(key: string, defaultValue?: any) {
    return this.data[key] === undefined
      ? defaultValue
      : JSON.parse(this.data[key]);
  }

  async set(key: string, value: any) {
    this.data[key] = JSON.stringify(value);
  }

  async clear() {
    this.data = {};
  }
}

let _cache: RepoDBCache = new InMemCache();

export function setCache(cache: RepoDBCache) {
  _cache = cache;
}

export function getCache(): RepoDBCache {
  return _cache;
}

export function getHeaders(
  token: string,
  headers?: { [key: string]: string }
): { [key: string]: string } {
  const defaults = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
  };
  return { ...defaults, ...headers };
}

export async function getRepository({
  repo,
  token,
}: {
  repo: string;
  token: string;
}): Promise<GithubRepo> {
  return (
    await axios.get(`${BASE_URL}/repos/${repo}`, {
      headers: getHeaders(token),
    })
  ).data as GithubRepo;
}

export async function getBranch({
  repo,
  branch,
  token,
}: {
  repo: string;
  branch?: string;
  token: string;
}): Promise<GithubBranch> {
  if (!branch) {
    const repoInfo = await getRepository({ repo, token });
    branch = repoInfo.default_branch;
  }
  const now = new Date();
  now.setSeconds(now.getSeconds() - 30);
  return (
    await axios.get(`${BASE_URL}/repos/${repo}/branches/${branch}`, {
      headers: getHeaders(token, { 'If-Modified-Since': now.toUTCString() }),
    })
  ).data as GithubBranch;
}

export async function cleanRepoString({
  input,
  token,
}: {
  input: string;
  token: string;
}) {
  if (input.startsWith('https://github.com/')) {
    input = input.substring(19);
  }
  const match = input.match(/^[^\/]+\/[^\/#]+/);
  let repo;
  if (match) {
    repo = match[0];
  } else {
    throw new Error('Invalid repository');
  }

  input = input.substring(repo.length);
  if (input.startsWith('/')) {
    input = input.substring(1);
  }

  const repoData = await getRepository({ repo, token });

  let [path, branch] = input.split('#');

  if (path === '/') {
    path = '';
  }

  if (branch) {
    const branchObj = await getBranch({ repo, branch, token });
    branch = branchObj.name;
  }

  return {
    repr: `${repoData.full_name}${path ? `/${path}` : ''}${
      branch ? `#${branch}` : ''
    }`,
    repo: repoData.full_name,
    path: path,
    branch: branch,
  };
}

export function _getContentType(path: string): string | null {
  let extension = (path.match(/^.*?(\.[^\.]*)?$/) as string[])[1];
  if (!extension) return null;
  extension = extension.toLowerCase();
  if (extension == '.stp') {
    extension = '.step';
  }
  if (['.step', '.f3d', '.svg', '.dxf'].indexOf(extension) !== -1) {
    return extension.substring(1);
  } else if (extension === '.png') {
    return 'thumb';
  } else if (extension === '.json') {
    return 'meta';
  }
  return null;
}

export function _buildTree({
  tree,
  root,
  id_prefix,
  repo,
  branch,
}: {
  tree: GithubTreeNode[];
  root: string;
  id_prefix?: string;
  repo: string;
  branch?: string;
}) {
  const results = [];
  while (tree.length > 0) {
    let node = {
      ...tree[0],
      id: `${id_prefix}|${tree[0].path}`,
      name:
        tree[0].path
          .split('/')
          .pop()
          ?.match(/^(.*?)(\.[^\.]*)?$/)?.[0] || '',
    } as RepoNode;

    if (!node.path.startsWith(root)) {
      break;
    }

    tree.shift();
    if (node.type == 'tree') {
      node.children = _buildTree({
        tree,
        root: `${node.path}/`,
        id_prefix,
        repo,
        branch,
      });
      if (node.children.length === 0) {
        continue;
      }
    } else if (node.type == 'blob') {
      const contentType = _getContentType(node.path);
      if (!contentType) {
        continue;
      }
      (node as BlobRepoNode).content_types = {
        [contentType]: {
          url: (node as unknown as GithubTreeNode).url,
          size: (node as unknown as GithubTreeNode).size,
          path: node.path,
          repo,
          branch,
        },
      };
      node.path = (node.path.match(/^(.*?)(\.[^\.]*)?$/) as string[])[1];
      node.name = (node.name.match(/^(.*?)(\.[^\.]*)?$/) as string[])[1];
      if (results.length > 0) {
        const prev = results[results.length - 1];
        if (prev.type === 'blob' && prev.path === node.path) {
          results.pop();
          node = _mergeNodes(prev as BlobRepoNode, node as BlobRepoNode);
        }
      }
    }
    results.push(node);
  }

  return results;
}

export function _mergeTrees(t1: RepoNode[], t2: RepoNode[]): RepoNode[] {
  const results = [...t1];
  t2.forEach((node) => {
    let match = t1.filter((n) => n.name == node.name && n.type == node.type)[0];
    if (!match) {
      results.push(node);
      return;
    }
    match.sha = [
      ...match.sha.split(':').filter((n) => !!n),
      ...node.sha.split(':').filter((n) => !!n),
    ].join(':');

    if (match.type === 'tree') {
      match.children = _mergeTrees(match.children || [], node.children || []);
    } else {
      results.splice(results.indexOf(match), 1);
      match = _mergeNodes(match as BlobRepoNode, node as BlobRepoNode);
      results.push(match);
    }
  });
  return results;
}

export function _mergeNodes(n1: BlobRepoNode, n2: BlobRepoNode): BlobRepoNode {
  return { ...n1, content_types: { ...n1.content_types, ...n2.content_types } };
}

export async function getRepoTree({
  repo,
  branch,
  token,
  id_prefix,
}: {
  repo: string;
  branch?: string;
  token: string;
  id_prefix: string;
}): Promise<[RepoNode[], string | null]> {
  let branchObj: GithubBranch;
  try {
    branchObj = await getBranch({ repo, branch, token });
  } catch (err: any) {
    if (err?.response?.data?.message === 'Branch not found') {
      // Empty repository, doesn't have a branch or a tree... uhhh...
      return [[], null];
    } else {
      throw err;
    }
  }
  console.log(branchObj);

  let cachedTree = await _cache.get(`cache:tree:${repo}:${branchObj.name}`);
  if (!cachedTree || cachedTree.sha !== branchObj.commit.commit.tree.sha) {
    // outdated or missing cache
    console.log('cache miss', repo, branchObj.commit.commit);

    cachedTree = (
      await axios.get(
        `${BASE_URL}/repos/${repo}/git/trees/${branchObj.commit.commit.tree.sha}?recursive=1`,
        { headers: getHeaders(token) }
      )
    ).data;

    await _cache.set(`cache:tree:${repo}:${branchObj.name}`, cachedTree);
  }
  return [
    _buildTree({
      tree: cachedTree.tree,
      root: '',
      id_prefix,
      repo,
      branch: branchObj.name,
    }),
    branchObj.commit.commit.tree.sha,
  ];
}

export function getSubtree(tree: RepoNode[], root: string) {
  root = root.replace(/^\//, '').replace('//$', '');
  let t: RepoNode[] | undefined = tree;

  root.split('/').forEach((p) => {
    t = (t as RepoNode[]).filter((c) => c.name === p && c.type == 'tree')[0]
      ?.children;
    if (tree === undefined) {
      throw Error('Invalid repository path');
    }
  });

  function stripRoot(nodeList: RepoNode[], root: string) {
    const results = [];
    for (const node of nodeList) {
      const n = { ...node };
      n.path = n.path.substring(root.length + 1);
      const [collId, pathId] = n.id.split('|');
      n.id = `${collId}|${pathId.substring(root.length + 1)}`;
      if (n.type === 'tree' && n.children) {
        n.children = stripRoot(n.children, root);
      }
      results.push(n);
    }
    return results;
  }
  tree = stripRoot(tree, root);
  return tree;
}

export async function getMergedTrees({
  repositories,
  token,
  id_prefix,
  index,
  setLoadingMessage,
}: {
  repositories: string[];
  token: string;
  id_prefix: string;
  index: boolean;
  setLoadingMessage?: (msg: string) => void;
}): Promise<RepoNode[]> {
  let tree = [] as RepoNode[];
  const treeShas = [] as string[];

  for (const repo of repositories) {
    setLoadingMessage && setLoadingMessage(`Loading ${repo}...`);
    const match = repo.match(/^([\w-]+)\/([\w-]+)((?:\/[\w-]+)*)(#.*)?$/);
    if (match != null) {
      const [, owner, name, path, branchMatch] = match;
      let branch = branchMatch;
      if (branch) {
        branch = branch.substring(1);
      } else {
        const r = await getRepository({ repo: `${owner}/${name}`, token });
        branch = r.default_branch;
      }
      setLoadingMessage && setLoadingMessage(`Loading ${repo}#${branch}...`);
      const [newTree, newTreeSha] = await getRepoTree({
        repo: `${owner}/${name}`,
        branch,
        token,
        id_prefix,
      });
      if (newTreeSha) {
        treeShas.push(newTreeSha);
        if (path) {
          tree = _mergeTrees(tree, getSubtree(newTree, path));
        } else {
          tree = _mergeTrees(tree, newTree);
        }
      }
    }
  }

  if (index) {
    let progress = 0;
    const total = countNodes(tree);
    const perNodeFunc = () => {
      progress++;
      setLoadingMessage &&
        setLoadingMessage(`Indexing trees (${progress}/${total})...`);
    };

    tree = await indexTree({ tree, token, treeShas, perNodeFunc });
  }
  console.log('Merged trees', tree);
  const results = sortTree(pruneTree(tree));
  console.log(results);
  return results;
}

export function countNodes(tree: RepoNode[]): number {
  let count = 0;
  function traverse(node: RepoNode) {
    count++;
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  for (const node of tree) {
    traverse(node);
  }

  return count;
}

export function pruneTree(tree: RepoNode[]): RepoNode[] {
  const pruned = [] as RepoNode[];
  tree.forEach((n) => {
    if (n.type === 'tree') {
      n.children = pruneTree(n.children || []);
      if (n.children.length) {
        pruned.push(n);
      }
    } else if (n.type === 'blob') {
      const ct = (n as BlobRepoNode).content_types;
      if (ct && (ct.step || ct.f3d || ct.dxf || ct.svg)) {
        pruned.push(n);
      }
    }
  });
  return pruned;
}

export function sortTree(tree: RepoNode[]): RepoNode[] {
  tree
    .filter((node) => node.type === 'tree')
    .forEach((n) => {
      sortTree(n.children || []);
    });
  tree.sort(fileFolderSort);
  return tree;
}

export function fileFolderSort(a: RepoNode, b: RepoNode): number {
  const bIsTree = b.type === 'tree' ? 1 : 0;
  const aIsTree = a.type === 'tree' ? 1 : 0;
  return bIsTree - aIsTree || a.path.localeCompare(b.path);
}

export async function downloadBlob({
  url,
  token,
}: {
  url: string;
  token: string;
}): Promise<GithubBlob> {
  let cached = await _cache.get(`cache:blob:${url}`, null);
  if (cached === null) {
    const response = await axios.get(url, { headers: getHeaders(token) });
    cached = response.data;
    await _cache.set(`cache:blob:${url}`, cached);
  }
  return cached;
}

export async function downloadRawBlob({
  url,
  token,
}: {
  url: string;
  token: string;
}): Promise<Blob> {
  const response = await axios.get(url, {
    headers: getHeaders(token, { Accept: 'application/vnd.github.raw' }),
  });
  return new Blob([response.data]);
}

export async function downloadBlobJson({
  url,
  token,
}: {
  url: string;
  token: string;
}): Promise<any> {
  const blob = await downloadBlob({ url, token });
  let content = blob.content;
  if (blob.encoding === 'base64') {
    content = atob(content);
  }
  return JSON.parse(content);
}

export async function getOrgOrUserRepos({
  org,
  token,
}: {
  org: string;
  token: string;
}): Promise<OrgRepoNode[]> {
  const resp = await axios.get(
    `${BASE_URL}/users/${org}/repos`,
    getHeaders(token)
  );
  return resp.data.map((r: GithubRepo) => ({
    name: r.name,
    icon: 'mdi-github',
    expandable: true,
    type: 'repo',
    repositories: [
      { repo: r.full_name, repr: r.full_name, branch: r.default_branch },
    ],
    children: [],
  }));
}

export async function downloadBlobImageAsDataUri({
  url,
  token,
  content_type,
}: {
  url: string;
  token: string;
  content_type: string;
}): Promise<string> {
  const blob = await downloadBlob({ url, token });
  if (blob.encoding != 'base64') {
    blob.content = btoa(blob.content);
  }
  return `data:${content_type};base64,${blob.content}`;
}

export async function indexTree({
  tree,
  token,
  treeShas,
  perNodeFunc,
}: {
  tree: RepoNode[];
  token: string;
  treeShas: string[];
  perNodeFunc?: (n: RepoNode) => void;
}): Promise<RepoNode[]> {
  const cachedDirMeta = await _cache.get(
    `cache:meta:${treeShas.join(':')}`,
    null
  );

  let results = [];
  for (const n of tree) {
    perNodeFunc && perNodeFunc(n);
    if (n.type === 'tree' && n.children) {
      results.push({
        ...n,
        children: await indexTree({
          tree: n.children,
          token,
          treeShas: n.sha.split(':').filter((n) => !!n),
          perNodeFunc,
        }),
      });
      continue;
    }

    let meta;
    if (cachedDirMeta) {
      meta = cachedDirMeta[n.name] || {};
    } else if ((n as BlobRepoNode).content_types?.meta?.url) {
      try {
        meta = await downloadBlobJson({
          url: (n as BlobRepoNode).content_types?.meta?.url || '',
          token,
        });
      } catch (err) {
        meta = {};
      }
    }
    results.push({ ...n, meta });
  }

  const metaFile = results.filter(
    (n) => n.name == '_meta' && (n as BlobRepoNode).content_types?.meta
  )[0] as BlobRepoNode;

  if (metaFile) {
    if (!cachedDirMeta) {
      console.log('Downloading meta', metaFile.content_types?.meta?.url);
      const dirMeta = await downloadBlobJson({
        url: metaFile.content_types?.meta?.url || '',
        token,
      });
      applyMeta(results, dirMeta);
    }
    results = results.filter((n) => n.id !== metaFile.id);
  }

  if (!cachedDirMeta) {
    const cache: { [key: string]: any } = {};
    results.forEach((n: RepoNode) => {
      if (Object.keys((n as BlobRepoNode).meta || {}).length != 0) {
        cache[n.name] = (n as BlobRepoNode).meta;
      }
    });
    if (Object.keys(cache).length != 0) {
      _cache.set(`cache:meta:${treeShas.join(':')}`, cache);
    }
  }
  return results;
}

export function applyMeta(
  tree: RepoNode[],
  dirMeta: { [path: string]: { [path: string]: any } }
): void {
  for (const [path, meta] of Object.entries(dirMeta)) {
    const node = _getChildNodeByPath(tree, path) as BlobRepoNode;
    if (node && node.type == 'blob') {
      node.meta = {
        ...(node?.meta || {}),
        ...(meta || {}),
        keywords: _mergeKeywords(
          node?.meta?.keywords as string | string[],
          meta?.keywords as string | string[]
        ),
      };
    }
  }
}

export function _getChildNodeByPath(
  tree: RepoNode[],
  path: string
): RepoNode | null {
  let t: RepoNode | RepoNode[] | null = [...tree];
  if (path) {
    for (const p of path.split('/')) {
      if (Array.isArray(t)) {
        t = t.filter((n) => n.name === p)[0];
      } else {
        t = t.children?.filter((n) => n.name === p)[0] || null;
      }
      if (!t) return null;
    }
  }
  return t as RepoNode | null;
}

export function _mergeKeywords(kw1: string | string[], kw2: string | string[]) {
  kw1 = kw1 || [];
  kw2 = kw2 || [];

  kw1 = Array.isArray(kw1) ? kw1 : kw1.split(/\s+/);
  kw2 = Array.isArray(kw2) ? kw2 : kw2.split(/\s+/);
  const kw1Lower = kw1.map((kw) => kw.toLowerCase());

  return (
    [
      ...kw1,
      ...kw2.filter((kw) => kw1Lower.indexOf(kw.toLowerCase()) === -1),
    ].join(' ') || undefined
  );
}

export async function getLatestCommitForPath({
  repo,
  branch,
  path,
  token,
}: {
  repo: string;
  branch?: string;
  path: string;
  token: string;
}): Promise<GithubCommit> {
  const resp = await axios.get(`${BASE_URL}/repos/${repo}/commits`, {
    headers: getHeaders(token),
    params: {
      sha: branch,
      path,
      per_page: '1',
      page: '1',
    },
  });
  return resp.data[0];
}

export async function uploadFiles({
  repo,
  branch,
  token,
  files,
  message,
  progressCallback,
}: {
  repo: string;
  branch?: string;
  token: string;
  files: any[];
  message: string;
  progressCallback?: (done: number, total: number) => void;
}) {
  const total = files.reduce((prev, cur) => prev + cur.content.length, 0);
  let fileTotal = 0;
  if (progressCallback) progressCallback(0, total);

  files = await Promise.all(
    files.map(async (f) => {
      const resp = await axios.post(
        `${BASE_URL}/repos/${repo}/git/blobs`,
        {
          content: f.content,
          encoding: f.encoding,
        },
        {
          onUploadProgress: (progressEvent) => {
            if (progressCallback) {
              progressCallback(fileTotal + progressEvent.loaded, total);
            }
          },
          headers: getHeaders(token, { 'Content-Type': 'application/json' }),
        }
      );
      fileTotal += f.content.length;
      if (progressCallback) progressCallback(fileTotal, total);
      return {
        mode: '100644',
        type: 'blob',
        sha: resp.data.sha,
        path: f.path,
      };
    })
  );

  const branchObj = await getBranch({ repo, branch, token });
  const base_tree = branchObj.commit.commit.tree.sha;
  let resp = await axios.post(
    `${BASE_URL}/repos/${repo}/git/trees`,
    {
      base_tree,
      tree: files,
    },
    { headers: getHeaders(token, { 'Content-Type': 'application/json' }) }
  );
  const tree_sha = resp.data.sha;

  resp = await axios.post(
    `${BASE_URL}/repos/${repo}/git/commits`,
    {
      message,
      tree: tree_sha,
      parents: [branchObj.commit.sha],
    },
    { headers: getHeaders(token, { 'Content-Type': 'application/json' }) }
  );
  const commit_sha = resp.data.sha;
  resp = await axios.patch(
    `${BASE_URL}/repos/${repo}/git/refs/heads/${branchObj.name}`,
    { sha: commit_sha },
    { headers: getHeaders(token, { 'Content-Type': 'application/json' }) }
  );
}

export async function verifyToken({ token }: { token: string }) {
  try {
    await axios.get(`${BASE_URL}/user`, {
      headers: getHeaders(token),
    });
    return true;
  } catch (err) {
    if (err?.response && err?.response?.status === 401) {
      console.log('401', err.response.data);
      return false;
    }
  }
}
