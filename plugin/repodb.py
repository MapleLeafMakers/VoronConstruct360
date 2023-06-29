import json
import os
import re
from contextlib import closing
import sqlite3
import base64
import requests
import hashlib

   

class RepoDB:
    def __init__(self, sqlite_file=":memory:", github_token=None):
        self.sqlite_file = sqlite_file
        self.conn = sqlite3.connect(sqlite_file)
        self._init_db()
        self.github_token = github_token

    def _init_db(self):
        self.conn.execute("CREATE TABLE IF NOT EXISTS repositories(name, tree_sha, contents);")
        self.conn.execute("CREATE TABLE IF NOT EXISTS thumbnails (url, data_url);")

    def _get_latest_commit(self, repo_name):
        response = requests.get(
            "https://api.github.com/repos/{}/commits?per_page=1".format(repo_name),
            headers=dict(
                Accept='application/vnd.github+json',
                Authorization='Bearer {}'.format(self.github_token)
            )
        )
        if response.status_code == 200:
            return response.json()[0]['commit']
        raise Exception("Repository {} not found.\n{}".format(repo_name, response.json()))

    def _get_tree(self, repo_name, sha):
        response = requests.get(
            "https://api.github.com/repos/{}/git/trees/{}?recursive=true".format(repo_name, sha),
            headers=dict(
                Accept='application/vnd.github+json',
                Authorization='Bearer {}'.format(self.github_token)
            )
        )
        if response.status_code == 200:
            return response.json()['tree']
        raise Exception("Failed to load repository contents from {} [{}: {}]".format(repo_name, response.status_code, response.content))

    def _get_content_type(self, filename):
        _, ext = os.path.splitext(filename.lower())
        if ext in ('.step', '.stp'):
            return 'step'
        elif ext == '.f3d':
            return 'f3d'
        elif ext == '.svg':
            return 'svg'
        elif ext == '.dxf':
            return 'dxf'
        elif ext == '.png':
            return 'thumb'

    def get_thumb(self, url):
        with closing(self.conn.execute("SELECT data_url FROM thumbnails WHERE url = ?", (url, ))) as cursor:
            thumb = cursor.fetchone()
            if not thumb:
                response = requests.get(url, headers=dict(Accept="application/vnd.github.raw", Authorization="Bearer {}".format(self.github_token)))
                thumb = 'data:image/png;base64,{}'.format(base64.b64encode(response.content).decode('utf8')) 
                cursor.execute("INSERT INTO thumbnails (url, data_url) VALUES (?, ?)", (url, thumb));
                self.conn.commit()
        return thumb
    
    def upload_thumbnail(self, repo, path, data):
        url = 'https://api.github.com/repos/{}/contents/{}.png'.format(repo, path)
        response = requests.get(url, headers={'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer {}'.format(self.github_token)})
        prev_sha = None
        if response.status_code == 200:
            prev_sha = response.json()['sha']

        response = requests.put(
            url, 
            json=dict(
                sha=prev_sha,
                message="add thumbnail for {}".format(path),
                content=data,
            ), 
            headers={'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer {}'.format(self.github_token)})

        if response.status_code not in (200, 201):
            raise Exception(response.json()['message'])
        

    def merge_contents(self, tree1, tree2):
        for node in tree2:
            match = [n for n in tree1 if n['name'] == node['name'] and n['type'] == node['type']]
            if not match:
                tree1.append(node)
                continue
            match = match[0]
            if match['type'] == 'tree':
                match['children'] = self.merge_contents(match['children'], node['children'])
            else:
                self._merge_nodes(match, node)
        return tree1
            
    def _merge_nodes(self, node1, node2):
        node1['content_types'].update(node2['content_types'])
        return node1

    def _build_tree(self, contents, root='', id_prefix=''):
        results = []
        while contents:
            node = contents[0]
            if not node['path'].startswith(root):
                break
            contents.pop(0)
            node['id'] = '{}|{}'.format(id_prefix, node['path'])
            node['name'] = node['path'].split('/')[-1]
            node['name'], _ = os.path.splitext(node['name'])
            del node['sha']
            del node['mode']
            if node['type'] == 'tree':
                node['children'] = self._build_tree(contents, root='{}/'.format(node['path']), id_prefix=id_prefix)
                if not node['children']:
                    continue
            elif node['type'] == 'blob':
                content_type = self._get_content_type(node['path'])
                if not content_type:
                    continue
                node['content_types'] = {content_type: {'url': node['url'], 'size': node['size'], 'path': node['path']}}
                node['path'], _ = os.path.splitext(node['path'])
                del node['url']
                del node['size']                
                if results and results[-1]['type'] == 'blob':
                    if results[-1]['path'] == node['path']:
                        prev = results.pop()                        
                        node = self._merge_nodes(prev, node)
                    
            results.append(node)
        return sorted([r for r in results if r['type'] == 'tree' or (
                (len(r['content_types']) >= 1 and 'thumb' not in r['content_types']) or (
                    len(r['content_types']) >= 2 and 'thumb' in r['content_types']))], key=lambda e: (e['type'] != 'tree', e['name']))

    def get_repository_contents(self, repo_name, path=None, id_prefix=''):
        with closing(self.conn.execute("SELECT name, tree_sha, contents from repositories where lower(name) = ?",
                                       (repo_name.lower(),))) as cursor:
            cached_repo = cursor.fetchone()
        latest_commit = self._get_latest_commit(repo_name)
        latest_tree = latest_commit['tree']['sha']
        repo_name = re.search(r'^https://api\.github\.com/repos/([^/]+/[^/]+)/', latest_commit['url']).groups()[0]
        if not cached_repo or cached_repo[1] != latest_tree:
            # no cache, or cache outdated
            contents = self._build_tree(self._get_tree(repo_name, latest_tree), id_prefix=id_prefix)
            if cached_repo is not None:
                self.conn.execute("DELETE FROM repositories WHERE lower(name) = ?", (repo_name.lower(),))
            self.conn.execute("INSERT INTO repositories (name, tree_sha, contents) VALUES (?, ?, ?)", (repo_name, latest_tree, json.dumps(contents)))
            self.conn.commit()
        else:
            contents = json.loads(cached_repo[2])
        
        if path:
            for p in path:
                contents = [c for c in contents if c['type'] == 'tree' and c['name'] == p][0]['children']
        return contents
