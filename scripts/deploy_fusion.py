#!/usr/bin/env python3
"""
Deploy VoronConstruct360 Add-In to Autodesk Fusion 360 AddIns directory.
This script dynamically resolves the target directory based on the OS
environment without hardcoding any user or machine paths.
"""

import os
import sys
import shutil
import subprocess

def get_fusion_addin_dir():
    # 1. Environment variable override if specified
    env_override = os.environ.get('FUSION_ADDINS_DIR')
    if env_override:
        return os.path.join(env_override, 'Construct')

    # 2. Windows default: %APPDATA%/Autodesk/Autodesk Fusion 360/API/AddIns/Construct
    if sys.platform == 'win32':
        appdata = os.environ.get('APPDATA')
        if not appdata:
            raise RuntimeError("APPDATA environment variable not found.")
        return os.path.join(appdata, 'Autodesk', 'Autodesk Fusion 360', 'API', 'AddIns', 'Construct')

    # 3. macOS default: ~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/Construct
    if sys.platform == 'darwin':
        return os.path.expanduser('~/Library/Application Support/Autodesk/Autodesk Fusion 360/API/AddIns/Construct')

    raise RuntimeError(f"Unsupported operating system: {sys.platform}. Please set FUSION_ADDINS_DIR.")

def deploy(build_frontend=False):
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    plugin_dir = os.path.join(repo_root, 'plugin')
    dist_dir = os.path.join(repo_root, 'dist', 'spa')
    dest_dir = get_fusion_addin_dir()

    print(f"Target Fusion 360 AddIn directory:\n  {dest_dir}\n")

    if build_frontend:
        print("Building frontend...")
        npm_cmd = shutil.which('npm')
        quasar_cmd = shutil.which('quasar')
        if npm_cmd:
            subprocess.run(['npm', 'run', 'build'], cwd=repo_root, check=True, shell=(sys.platform == 'win32'))
        elif quasar_cmd:
            subprocess.run(['quasar', 'build'], cwd=repo_root, check=True, shell=(sys.platform == 'win32'))
        else:
            print("Notice: Neither 'npm' nor 'quasar' found in PATH. Skipping frontend compilation.")

    os.makedirs(dest_dir, exist_ok=True)

    # Copy plugin files (preserving existing db.sqlite3, lib/, etc.)
    print("Copying plugin files to Fusion AddIns folder...")
    for item in os.listdir(plugin_dir):
        src_item = os.path.join(plugin_dir, item)
        dst_item = os.path.join(dest_dir, item)

        if os.path.isdir(src_item):
            shutil.copytree(src_item, dst_item, dirs_exist_ok=True)
        else:
            shutil.copy2(src_item, dst_item)

    # If built frontend exists, copy to dest_dir/ui
    if os.path.exists(dist_dir):
        ui_dest = os.path.join(dest_dir, 'ui')
        print(f"Copying built frontend from {dist_dir} to {ui_dest}...")
        os.makedirs(ui_dest, exist_ok=True)
        shutil.copytree(dist_dir, ui_dest, dirs_exist_ok=True)
        print("Frontend successfully copied to AddIn ui folder.")
    else:
        print("Note: 'dist/spa' does not exist yet. Run 'npm run build' to compile the frontend UI into the add-in.")

    print("\nDeploy completed successfully!")

if __name__ == '__main__':
    build_flag = '--build' in sys.argv
    deploy(build_frontend=build_flag)

