using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

namespace VoronConstructInstaller
{
    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool isSilent = false;
            foreach (string arg in args)
            {
                if (arg.Equals("/s", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("/silent", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("/quiet", StringComparison.OrdinalIgnoreCase) ||
                    arg.Equals("-s", StringComparison.OrdinalIgnoreCase))
                {
                    isSilent = true;
                }
            }

            if (isSilent)
            {
                try
                {
                    PerformInstall((msg) => { });
                    return 0;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("Error: " + ex.Message);
                    return 1;
                }
            }
            else
            {
                Application.Run(new InstallerForm());
                return 0;
            }
        }

        public static string GetTargetDirectory()
        {
            string envOverride = Environment.GetEnvironmentVariable("FUSION_ADDINS_DIR");
            if (!string.IsNullOrEmpty(envOverride))
            {
                return Path.Combine(envOverride, "Construct");
            }

            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            return Path.Combine(appData, "Autodesk", "Autodesk Fusion 360", "API", "AddIns", "Construct");
        }

        public static bool IsFusionRunning()
        {
            return Process.GetProcessesByName("Fusion360").Length > 0 ||
                   Process.GetProcessesByName("Autodesk.Fusion360").Length > 0;
        }

        public static void PerformInstall(Action<string> statusCallback)
        {
            string targetDir = GetTargetDirectory();
            statusCallback("Preparing destination: " + targetDir);

            if (!Directory.Exists(targetDir))
            {
                Directory.CreateDirectory(targetDir);
            }

            // 1. Check embedded resource first
            Assembly asm = Assembly.GetExecutingAssembly();
            Stream zipStream = asm.GetManifestResourceStream("PluginZip");

            if (zipStream != null)
            {
                statusCallback("Extracting embedded add-in files...");
                using (ZipArchive archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
                {
                    foreach (ZipArchiveEntry entry in archive.Entries)
                    {
                        if (string.IsNullOrEmpty(entry.Name) && entry.FullName.EndsWith("/"))
                        {
                            string dirPath = Path.Combine(targetDir, entry.FullName.Replace('/', '\\'));
                            if (!Directory.Exists(dirPath))
                            {
                                Directory.CreateDirectory(dirPath);
                            }
                            continue;
                        }

                        string destinationPath = Path.Combine(targetDir, entry.FullName.Replace('/', '\\'));
                        string parentDir = Path.GetDirectoryName(destinationPath);
                        if (!Directory.Exists(parentDir))
                        {
                            Directory.CreateDirectory(parentDir);
                        }

                        // Protect existing user database
                        if (entry.Name.Equals("db.sqlite3", StringComparison.OrdinalIgnoreCase) && File.Exists(destinationPath))
                        {
                            continue;
                        }

                        entry.ExtractToFile(destinationPath, true);
                    }
                }
            }
            else
            {
                // 2. Check local repo structure if run directly from repository
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string pluginDir = Path.Combine(baseDir, "plugin");
                if (!Directory.Exists(pluginDir))
                {
                    pluginDir = Path.Combine(baseDir, "..", "plugin");
                }

                if (Directory.Exists(pluginDir))
                {
                    statusCallback("Copying files from local plugin directory...");
                    CopyDirectory(new DirectoryInfo(pluginDir), new DirectoryInfo(targetDir), statusCallback);
                }
                else
                {
                    throw new FileNotFoundException("Neither embedded add-in archive nor adjacent 'plugin' folder was found.");
                }

                // Check for dist/spa (frontend UI)
                string distDir = Path.Combine(baseDir, "dist", "spa");
                if (!Directory.Exists(distDir))
                {
                    distDir = Path.Combine(baseDir, "..", "dist", "spa");
                }

                if (Directory.Exists(distDir))
                {
                    statusCallback("Copying built frontend UI...");
                    string uiDest = Path.Combine(targetDir, "ui");
                    CopyDirectory(new DirectoryInfo(distDir), new DirectoryInfo(uiDest), statusCallback);
                }
            }

            statusCallback("Add-In files deployed successfully!");
        }

        private static void CopyDirectory(DirectoryInfo source, DirectoryInfo target, Action<string> statusCallback)
        {
            if (!target.Exists)
            {
                target.Create();
            }

            foreach (FileInfo fi in source.GetFiles())
            {
                if (fi.Name.Equals("db.sqlite3", StringComparison.OrdinalIgnoreCase) && File.Exists(Path.Combine(target.FullName, fi.Name)))
                {
                    continue;
                }
                fi.CopyTo(Path.Combine(target.FullName, fi.Name), true);
            }

            foreach (DirectoryInfo diSourceSubDir in source.GetDirectories())
            {
                DirectoryInfo nextTargetSubDir = target.CreateSubdirectory(diSourceSubDir.Name);
                CopyDirectory(diSourceSubDir, nextTargetSubDir, statusCallback);
            }
        }
    }

    public class InstallerForm : Form
    {
        private Label lblHeader;
        private Label lblPath;
        private Label lblStatus;
        private ProgressBar progressBar;
        private Button btnInstall;
        private Button btnClose;

        public InstallerForm()
        {
            InitializeComponent();
        }

        private void InitializeComponent()
        {
            this.Text = "Voron Construct 360 - Add-In Setup";
            this.Width = 520;
            this.Height = 280;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point);
            this.BackColor = Color.FromArgb(245, 246, 248);

            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            lblHeader = new Label();
            lblHeader.Text = "Install Voron Construct 360 for Autodesk Fusion 360";
            lblHeader.Font = new Font("Segoe UI", 11F, FontStyle.Bold, GraphicsUnit.Point);
            lblHeader.Location = new Point(20, 15);
            lblHeader.Size = new Size(470, 25);
            lblHeader.ForeColor = Color.FromArgb(30, 41, 59);

            lblPath = new Label();
            lblPath.Text = "Destination:\n" + Program.GetTargetDirectory();
            lblPath.Location = new Point(20, 50);
            lblPath.Size = new Size(470, 45);
            lblPath.ForeColor = Color.FromArgb(71, 85, 105);

            lblStatus = new Label();
            lblStatus.Text = "Click 'Install / Update' to deploy the add-in.";
            lblStatus.Location = new Point(20, 105);
            lblStatus.Size = new Size(470, 20);
            lblStatus.ForeColor = Color.FromArgb(51, 65, 85);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(20, 135);
            progressBar.Size = new Size(465, 22);
            progressBar.Style = ProgressBarStyle.Blocks;
            progressBar.Visible = false;

            btnInstall = new Button();
            btnInstall.Text = "Install / Update";
            btnInstall.Location = new Point(265, 190);
            btnInstall.Size = new Size(125, 32);
            btnInstall.BackColor = Color.FromArgb(37, 99, 235);
            btnInstall.ForeColor = Color.White;
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Click += BtnInstall_Click;

            btnClose = new Button();
            btnClose.Text = "Close";
            btnClose.Location = new Point(400, 190);
            btnClose.Size = new Size(85, 32);
            btnClose.BackColor = Color.White;
            btnClose.FlatStyle = FlatStyle.Flat;
            btnClose.FlatAppearance.BorderColor = Color.FromArgb(203, 213, 225);
            btnClose.Click += (s, e) => this.Close();

            this.Controls.Add(lblHeader);
            this.Controls.Add(lblPath);
            this.Controls.Add(lblStatus);
            this.Controls.Add(progressBar);
            this.Controls.Add(btnInstall);
            this.Controls.Add(btnClose);
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            btnInstall.Enabled = false;
            progressBar.Visible = true;
            progressBar.Style = ProgressBarStyle.Marquee;

            try
            {
                bool isRunning = Program.IsFusionRunning();

                Program.PerformInstall((msg) =>
                {
                    lblStatus.Text = msg;
                    Application.DoEvents();
                });

                progressBar.Style = ProgressBarStyle.Blocks;
                progressBar.Value = 100;
                lblStatus.Text = "Installation completed successfully!";

                string successMsg = "Voron Construct 360 has been successfully installed!";
                if (isRunning)
                {
                    successMsg += "\n\nNote: Autodesk Fusion 360 is currently running. Please restart Fusion 360 or reload the Add-In to apply changes.";
                }
                else
                {
                    successMsg += "\n\nYou can now launch Autodesk Fusion 360 and find Voron Construct under the Solid -> Insert menu.";
                }

                MessageBox.Show(this, successMsg, "Installation Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.Close();
            }
            catch (Exception ex)
            {
                progressBar.Visible = false;
                btnInstall.Enabled = true;
                lblStatus.Text = "Error during installation.";
                MessageBox.Show(this, "Installation failed:\n" + ex.Message, "Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
