#!/usr/bin/env python3
"""
Builds a standalone self-contained setup.exe installer for VoronConstruct360.
The installer embeds the add-in files into a single Windows executable.
No user or computer-specific info is baked in; paths are resolved dynamically at runtime.
"""

import os
import sys
import shutil
import zipfile
import subprocess

def find_csc():
    candidates = [
        r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
        r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    csc_path = shutil.which("csc")
    if csc_path:
        return csc_path
    raise RuntimeError("Visual C# compiler (csc.exe) not found.")

def build_installer():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    plugin_dir = os.path.join(repo_root, "plugin")
    installer_cs = os.path.join(repo_root, "scripts", "Installer.cs")
    favicon_ico = os.path.join(repo_root, "public", "favicon.ico")
    dist_spa = os.path.join(repo_root, "dist", "spa")
    output_exe = os.path.join(repo_root, "setup.exe")
    temp_zip = os.path.join(repo_root, "scripts", "_bundle.zip")

    print("=== Building VoronConstruct360 Setup.exe ===")

    # 1. Create bundle zip containing plugin files
    print("Packaging add-in files into bundle...")
    with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add plugin files
        for root, dirs, files in os.walk(plugin_dir):
            if "__pycache__" in root:
                continue
            for file in files:
                if file.endswith(".pyc") or file == "db.sqlite3":
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, plugin_dir)
                zf.write(full_path, rel_path)

        # If plugin/lib doesn't exist in repo, check user's AddIns folder to bundle dependencies
        plugin_lib = os.path.join(plugin_dir, "lib")
        if not os.path.exists(plugin_lib):
            appdata = os.environ.get("APPDATA")
            if appdata:
                existing_lib = os.path.join(appdata, "Autodesk", "Autodesk Fusion 360", "API", "AddIns", "Construct", "lib")
                if os.path.exists(existing_lib):
                    print("Bundling python dependencies from existing add-in lib folder...")
                    for root, dirs, files in os.walk(existing_lib):
                        if "__pycache__" in root:
                            continue
                        for file in files:
                            full_path = os.path.join(root, file)
                            rel_path = os.path.relpath(full_path, existing_lib)
                            zf.write(full_path, os.path.join("lib", rel_path))

        # Add built frontend UI if available
        if os.path.exists(dist_spa):
            print("Bundling compiled frontend UI into bundle...")
            for root, dirs, files in os.walk(dist_spa):
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, dist_spa)
                    zf.write(full_path, os.path.join("ui", rel_path))

    # 2. Compile setup.exe using csc.exe embedding the bundle zip
    csc_path = find_csc()
    print(f"Compiling standalone setup.exe using {csc_path}...")

    cmd = [
        csc_path,
        "/target:winexe",
        f"/out:{output_exe}",
        "/optimize+",
        "/r:System.IO.Compression.FileSystem.dll",
        "/r:System.IO.Compression.dll",
        "/r:System.Windows.Forms.dll",
        "/r:System.Drawing.dll",
        f"/resource:{temp_zip},PluginZip",
        installer_cs
    ]

    if os.path.exists(favicon_ico):
        cmd.append(f"/win32icon:{favicon_ico}")

    result = subprocess.run(cmd, capture_output=True, text=True)

    # 3. Clean up temporary zip
    if os.path.exists(temp_zip):
        os.remove(temp_zip)

    if result.returncode != 0:
        print("Compilation failed:")
        print(result.stdout)
        print(result.stderr)
        sys.exit(result.returncode)

    file_size_kb = os.path.getsize(output_exe) / 1024
    print(f"\nSUCCESS: Generated standalone installer:")
    print(f"  {output_exe} ({file_size_kb:.1f} KB)")
    print("Ready to run on any Windows machine!")

if __name__ == '__main__':
    build_installer()
