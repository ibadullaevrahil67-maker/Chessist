// Chessist Overlay — C# / .NET 4.8 / GDI+
// Transparent overlay window driven by newline-delimited JSON draw commands on stdin.
// The Electron app spawns ChessistOverlay.exe and writes WsMsg JSON to its stdin.
// Build:  dotnet build -c Release
//         output: overlay\bin\Release\net48\ChessistOverlay.exe

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace ChessistEngine
{
    // ── JSON data contracts ──────────────────────────────────────────────────────

    [DataContract] class EvalBarMsg
    {
        [DataMember(Name = "fillPercent")] public double FillPercent;
        [DataMember(Name = "isFlipped")]   public bool   IsFlipped;
        [DataMember(Name = "score")]       public string? Score;
    }

    [DataContract] class ArrowMsg
    {
        [DataMember(Name = "from")] public string? From;
        [DataMember(Name = "to")]   public string? To;
    }

    // JS sends raw viewport-relative CSS coords; C# resolves screen position via ClientToScreen.
    [DataContract] class WsMsg
    {
        // Overlay display fields
        [DataMember(Name = "visible")]      public bool        Visible;
        [DataMember(Name = "positionOnly")] public bool        PositionOnly;
        [DataMember(Name = "flipped")]      public bool        Flipped;
        [DataMember(Name = "viewX")]        public double      ViewX;
        [DataMember(Name = "viewY")]        public double      ViewY;
        [DataMember(Name = "width")]        public double      Width;
        [DataMember(Name = "height")]       public double      Height;
        [DataMember(Name = "dpr")]          public double      Dpr;
        [DataMember(Name = "evalBar")]      public EvalBarMsg?  EvalBar;
        [DataMember(Name = "arrows")]       public ArrowMsg[]?  Arrows;
        [DataMember(Name = "manualMap")]    public bool        ManualMap;
        [DataMember(Name = "offsetX")]      public int         OffsetX;
        [DataMember(Name = "offsetY")]      public int         OffsetY;

        // Engine control fields (type != null → engine message, not overlay update)
        [DataMember(Name = "type",    EmitDefaultValue = false)] public string? Type;
        [DataMember(Name = "fen",     EmitDefaultValue = false)] public string? Fen;
        [DataMember(Name = "depth",   EmitDefaultValue = false)] public int     Depth;
        [DataMember(Name = "multiPv", EmitDefaultValue = false)] public int     MultiPv;
        [DataMember(Name = "name",    EmitDefaultValue = false)] public string? Name;
        [DataMember(Name = "value",   EmitDefaultValue = false)] public string? Value;
        [DataMember(Name = "turn",    EmitDefaultValue = false)] public string? Turn;
    }

    // ── Win32 P/Invoke ────────────────────────────────────────────────────────────

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)] struct POINT  { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct WSIZE  { public int W, H; }
    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    struct BLENDFUNCTION { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }

    [StructLayout(LayoutKind.Sequential)]
    struct BITMAPINFO
    {
        public uint   biSize;
        public int    biWidth, biHeight;
        public ushort biPlanes, biBitCount;
        public uint   biCompression, biSizeImage;
        public int    biXPelsPerMeter, biYPelsPerMeter;
        public uint   biClrUsed, biClrImportant;
        public uint   bmiColors;
    }

    // ── Overlay window ────────────────────────────────────────────────────────────

    sealed class OverlayForm : Form
    {
        const int  GWL_EXSTYLE        = -20;
        const int  WS_EX_LAYERED      = 0x00080000;
        const int  WS_EX_TRANSPARENT  = 0x00000020;
        const int  WS_EX_NOACTIVATE   = 0x08000000;
        const int  WS_EX_TOOLWINDOW   = 0x00000080;
        const uint WDA_EXCLUDEFROMCAPTURE  = 0x00000011;
        const uint ULW_ALPHA               = 2;
        const byte AC_SRC_OVER             = 0;
        const byte AC_SRC_ALPHA            = 1;
        [DllImport("user32.dll")] static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst, ref WSIZE psize, IntPtr hdcSrc, ref POINT pptSrc, uint crKey, ref BLENDFUNCTION pblend, uint dwFlags);
        [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
        [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);
        [DllImport("user32.dll")] static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint aff);
        [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr hwnd, int n, int val);
        [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr hwnd, int n);
        [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", CharSet = CharSet.Auto)] static extern int GetClassName(IntPtr hwnd, System.Text.StringBuilder buf, int n);
        [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc fn, IntPtr lParam);
        [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc fn, IntPtr lParam);
        [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hWnd, ref POINT pt);
        [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hWnd);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
        [DllImport("gdi32.dll")]  static extern IntPtr CreateCompatibleDC(IntPtr hdc);
        [DllImport("gdi32.dll")]  static extern IntPtr SelectObject(IntPtr hdc, IntPtr h);
        [DllImport("gdi32.dll")]  static extern bool DeleteDC(IntPtr hdc);
        [DllImport("gdi32.dll")]  static extern bool DeleteObject(IntPtr h);
        [DllImport("gdi32.dll")]  static extern IntPtr CreateDIBSection(IntPtr hdc, ref BITMAPINFO bi, uint usage, out IntPtr bits, IntPtr sec, uint off);
        [DllImport("kernel32.dll")] static extern void RtlMoveMemory(IntPtr dst, IntPtr src, int len);

        WsMsg? _state;
        System.Windows.Forms.Timer? _trackTimer;
        IntPtr _cachedRenderWnd;
        POINT  _lastOrigin;
        bool   _stateDirty;
        bool   _isBlank;
        IntPtr _lastFgWnd;
        bool   _lastFgIsBrowser;

        bool _manualMap;
        int  _manualOffsetX;
        int  _manualOffsetY;

        static string IniPath => Path.Combine(
            Path.GetDirectoryName(Application.ExecutablePath)!, "ChessistEngine.ini");

        static void ReadIni(out bool manualMap, out int offsetX, out int offsetY)
        {
            manualMap = false; offsetX = 0; offsetY = 0;
            if (!File.Exists(IniPath)) return;
            foreach (var line in File.ReadAllLines(IniPath))
            {
                var kv = line.Split('=');
                if (kv.Length != 2) continue;
                switch (kv[0].Trim())
                {
                    case "enabled": manualMap = kv[1].Trim() == "true"; break;
                    case "offsetX": int.TryParse(kv[1].Trim(), out offsetX); break;
                    case "offsetY": int.TryParse(kv[1].Trim(), out offsetY); break;
                }
            }
        }

        static void WriteIni(bool manualMap, int offsetX, int offsetY)
        {
            File.WriteAllText(IniPath,
                $"[ManualMap]\nenabled={manualMap.ToString().ToLower()}\noffsetX={offsetX}\noffsetY={offsetY}\n");
        }

        public OverlayForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar   = false;
            TopMost         = true;
            var vs = SystemInformation.VirtualScreen;
            SetBounds(vs.Left, vs.Top, vs.Width, vs.Height);
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
                return cp;
            }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            if (!DebugLog.Enabled)
                SetWindowDisplayAffinity(Handle, WDA_EXCLUDEFROMCAPTURE);

            ReadIni(out _manualMap, out _manualOffsetX, out _manualOffsetY);

            _trackTimer = new System.Windows.Forms.Timer { Interval = 16 };
            _trackTimer.Tick += (_, _) => Redraw();
            _trackTimer.Start();

            Blank();
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            _trackTimer?.Stop(); _trackTimer?.Dispose();
            base.OnFormClosed(e);
        }

        static readonly uint _selfPid = (uint)Process.GetCurrentProcess().Id;

        static bool IsActualBrowser(IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero) return false;
            GetWindowThreadProcessId(hwnd, out uint pid);
            if (pid == _selfPid) return true;
            try
            {
                using var proc = Process.GetProcessById((int)pid);
                string name = proc.ProcessName.ToLowerInvariant();
                return name == "chrome" || name == "msedge" || name == "brave" || name == "firefox";
            }
            catch { return false; }
        }

        public void Apply(WsMsg msg)
        {
            if (InvokeRequired) { Invoke((Action<WsMsg>)Apply, msg); return; }

            if (msg.PositionOnly && _state != null)
            {
                _state.ViewX    = msg.ViewX;
                _state.ViewY    = msg.ViewY;
                _state.Width    = msg.Width;
                _state.Height   = msg.Height;
                _state.Dpr      = msg.Dpr;
                _state.Visible  = msg.Visible;
            }
            else
            {
                // Preserve previous arrows when the update carries no arrows (e.g. sub-depth eval
                // bar update) but the overlay is still visible — avoids blanking arrows mid-analysis.
                var prevArrows = (msg.Visible && msg.Arrows == null && _state != null) ? _state.Arrows : null;
                _state = msg;
                if (prevArrows != null) _state.Arrows = prevArrows;
                if (_manualMap != msg.ManualMap || _manualOffsetX != msg.OffsetX || _manualOffsetY != msg.OffsetY)
                {
                    _manualMap    = msg.ManualMap;
                    _manualOffsetX = msg.OffsetX;
                    _manualOffsetY = msg.OffsetY;
                    WriteIni(_manualMap, _manualOffsetX, _manualOffsetY);
                }
            }
            _stateDirty = true;

            Redraw();
        }

        void Redraw()
        {
            if (_state == null || !_state.Visible || _state.Width <= 0)
            {
                Blank(); return;
            }

            IntPtr fg = GetForegroundWindow();
            if (fg != _lastFgWnd) { _lastFgWnd = fg; _lastFgIsBrowser = IsActualBrowser(fg); }
            if (!_lastFgIsBrowser) { Blank(); return; }

            if (_cachedRenderWnd == IntPtr.Zero || !IsWindow(_cachedRenderWnd))
                _cachedRenderWnd = FindRenderWidget(fg);

            var origin = new POINT { X = 0, Y = 0 };
            if (_cachedRenderWnd != IntPtr.Zero)
                ClientToScreen(_cachedRenderWnd, ref origin);

            bool moved = origin.X != _lastOrigin.X || origin.Y != _lastOrigin.Y;
            if (!moved && !_stateDirty) return;

            _lastOrigin  = origin;
            _stateDirty  = false;

            if (DebugLog.Enabled)
                Console.WriteLine($"  [redraw] render=0x{_cachedRenderWnd.ToInt64():X}  origin=({origin.X},{origin.Y})  view=({_state.ViewX:F1},{_state.ViewY:F1})  w={_state.Width:F0}  dpr={_state.Dpr:F2}");

            double dpr  = _state.Dpr > 0 ? _state.Dpr : 1.0;
            int physX = origin.X + (int)Math.Round((_state.ViewX + (_manualMap ? _manualOffsetX : 0)) * dpr);
            int physY = origin.Y + (int)Math.Round((_state.ViewY + (_manualMap ? _manualOffsetY : 0)) * dpr);
            int physW = (int)Math.Round(_state.Width  * dpr);
            int physH = (int)Math.Round(_state.Height * dpr);

            var vs = SystemInformation.VirtualScreen;
            using var bmp = new Bitmap(vs.Width, vs.Height, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(bmp))
            {
                g.Clear(Color.Transparent);
                g.SmoothingMode      = SmoothingMode.AntiAlias;
                g.CompositingQuality = CompositingQuality.HighQuality;

                float bx = physX - vs.Left;
                float by = physY - vs.Top;
                float bw = physW;
                float bh = physH;

                if (_state.EvalBar != null)
                    DrawEvalBar(g, bx, by, bh, _state.EvalBar);

                if (_state.Arrows != null)
                {
                    for (int i = _state.Arrows.Length - 1; i >= 0; i--)
                        DrawArrow(g, bx, by, bw, bh, _state.Flipped, _state.Arrows[i], i);
                }

                if (DebugLog.Enabled || _manualMap)
                {
                    bool log = DebugLog.Enabled;
                    DrawDebugDot(g, origin.X - vs.Left, origin.Y - vs.Top, Color.Cyan, "content-origin", log);
                    DrawDebugDot(g, bx,      by,      Color.Red,  "board-TL", log);
                    DrawDebugDot(g, bx + bw, by,      Color.Red,  "board-TR", log);
                    DrawDebugDot(g, bx,      by + bh, Color.Red,  "board-BL", log);
                    DrawDebugDot(g, bx + bw, by + bh, Color.Red,  "board-BR", log);
                }
            }

            if (DebugLog.Enabled)
                DebugLog.Position(physX, physY, physW, physH, origin.X, origin.Y, _state.ViewX, _state.ViewY, dpr);

            _isBlank = false;
            Blit(bmp, vs.Left, vs.Top);
        }

        IntPtr FindAnyBrowserRenderWidget()
        {
            IntPtr found = IntPtr.Zero;
            EnumWindows((hwnd, _) =>
            {
                if (!IsActualBrowser(hwnd)) return true;
                IntPtr rw = FindRenderWidget(hwnd);
                if (rw != IntPtr.Zero) { found = rw; return false; }
                return true;
            }, IntPtr.Zero);
            return found;
        }

        static IntPtr FindRenderWidget(IntPtr parent)
        {
            IntPtr found = IntPtr.Zero;
            if (parent == IntPtr.Zero) return found;
            EnumWindowsProc cb = (hwnd, _) =>
            {
                var sb = new System.Text.StringBuilder(64);
                GetClassName(hwnd, sb, sb.Capacity);
                if (sb.ToString() == "Chrome_RenderWidgetHostHWND")
                {
                    found = hwnd;
                    return false;
                }
                return true;
            };
            EnumChildWindows(parent, cb, IntPtr.Zero);
            return found;
        }

        void Blank()
        {
            if (_isBlank) return;
            _isBlank    = true;
            _lastOrigin = default;
            _stateDirty = true;
            var vs = SystemInformation.VirtualScreen;
            using var bmp = new Bitmap(vs.Width, vs.Height, PixelFormat.Format32bppArgb);
            Blit(bmp, vs.Left, vs.Top);
        }

        static void DrawDebugDot(Graphics g, float x, float y, Color color, string label, bool writeToConsole = true)
        {
            const float R = 7f;
            using var brush = new SolidBrush(Color.FromArgb(220, color));
            using var pen   = new Pen(Color.Black, 1.5f);
            g.FillEllipse(brush, x - R, y - R, R*2, R*2);
            g.DrawEllipse(pen,   x - R, y - R, R*2, R*2);
            if (writeToConsole)
            {
                Console.ForegroundColor = ConsoleColor.DarkYellow;
                Console.WriteLine($"  [dot] {label,-20} bitmap=({x:F0},{y:F0})");
                Console.ResetColor();
            }
        }

        // ── Drawing ───────────────────────────────────────────────────────────────

        static void DrawEvalBar(Graphics g, float bx, float by, float bh, EvalBarMsg eval)
        {
            const float W = 20f, GAP = 4f;
            float x = bx - W - GAP;

            using var bgBrush = new SolidBrush(Color.FromArgb(180, 20, 20, 20));
            g.FillRectangle(bgBrush, x, by, W, bh);

            float fill = (float)(eval.FillPercent / 100.0 * bh);
            float whiteH = eval.IsFlipped ? bh - fill : fill;
            float whiteY = eval.IsFlipped ? by : by + bh - fill;
            g.FillRectangle(Brushes.White, x, whiteY, W, whiteH);

            using var borderPen = new Pen(Color.FromArgb(60, 255, 255, 255), 1f);
            g.DrawRectangle(borderPen, x, by, W, bh);

            if (!string.IsNullOrEmpty(eval.Score))
            {
                using var font = new Font("Segoe UI", 7.5f, FontStyle.Bold);
                using var sf   = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
                float labelY = eval.IsFlipped ? by + bh * 0.88f : by + bh * 0.06f;
                var labelRect = new RectangleF(x, labelY - 9, W, 18);
                g.DrawString(eval.Score, font, Brushes.Black, labelRect, sf);
            }
        }

        static readonly Color[] ArrowClr =
        {
            Color.FromArgb(210, 121, 42, 158),
            Color.FromArgb(140, 184, 160,   0),
            Color.FromArgb(110, 184,  64,   0),
        };
        static readonly float[] ArrowW = { 2.2f, 1.8f, 1.6f };

        static void DrawArrow(Graphics g, float bx, float by, float bw, float bh, bool flipped, ArrowMsg arrow, int idx)
        {
            if (arrow.From == null || arrow.To == null || arrow.From.Length < 2 || arrow.To.Length < 2) return;

            PointF from = SquareCenter(arrow.From, bx, by, bw, bh, flipped);
            PointF to   = SquareCenter(arrow.To,   bx, by, bw, bh, flipped);

            float sqSz = bw / 8f;
            Color c    = idx < ArrowClr.Length ? ArrowClr[idx] : ArrowClr[0];
            float lw   = (idx < ArrowW.Length ? ArrowW[idx] : 2f) * sqSz / 12f;

            float dx = to.X - from.X, dy = to.Y - from.Y;
            float dist = (float)Math.Sqrt(dx * dx + dy * dy);
            if (dist < 1f) return;
            float ux = dx / dist, uy = dy / dist;
            float headLen = sqSz * 0.38f;
            float hw      = headLen * 0.44f;

            var shaft = new PointF(to.X - ux * headLen * 0.75f, to.Y - uy * headLen * 0.75f);
            using (var pen = new Pen(c, lw) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                g.DrawLine(pen, from, shaft);

            float px = -uy, py = ux;
            PointF[] head =
            {
                to,
                new PointF(to.X - ux * headLen + px * hw, to.Y - uy * headLen + py * hw),
                new PointF(to.X - ux * headLen - px * hw, to.Y - uy * headLen - py * hw),
            };
            using var brush = new SolidBrush(c);
            g.FillPolygon(brush, head);
        }

        static PointF SquareCenter(string sq, float bx, float by, float bw, float bh, bool flipped)
        {
            int file = sq[0] - 'a';
            int rank = sq[1] - '1';
            float col = flipped ? 7 - file : file;
            float row = flipped ? rank : 7 - rank;
            return new PointF(bx + (col + 0.5f) * (bw / 8f), by + (row + 0.5f) * (bh / 8f));
        }

        // ── UpdateLayeredWindow ───────────────────────────────────────────────────

        void Blit(Bitmap bmp, int x, int y)
        {
            var bd = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height),
                ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            int bytes = Math.Abs(bd.Stride) * bd.Height;
            var pixels = new byte[bytes];
            Marshal.Copy(bd.Scan0, pixels, 0, bytes);
            bmp.UnlockBits(bd);

            for (int i = 0; i < pixels.Length; i += 4)
            {
                byte a = pixels[i + 3];
                if (a == 255) continue;
                pixels[i + 0] = (byte)(pixels[i + 0] * a / 255);
                pixels[i + 1] = (byte)(pixels[i + 1] * a / 255);
                pixels[i + 2] = (byte)(pixels[i + 2] * a / 255);
            }

            var bi = new BITMAPINFO
            {
                biSize     = (uint)Marshal.SizeOf(typeof(BITMAPINFO)),
                biWidth    = bmp.Width,
                biHeight   = -bmp.Height,
                biPlanes   = 1,
                biBitCount = 32,
            };
            var handle = GCHandle.Alloc(pixels, GCHandleType.Pinned);
            IntPtr ppvBits;
            IntPtr hBitmap = CreateDIBSection(IntPtr.Zero, ref bi, 0, out ppvBits, IntPtr.Zero, 0);
            try
            {
                RtlMoveMemory(ppvBits, handle.AddrOfPinnedObject(), bytes);
            }
            finally { handle.Free(); }

            IntPtr hdcScreen = GetDC(IntPtr.Zero);
            IntPtr hdcMem    = CreateCompatibleDC(hdcScreen);
            IntPtr hOld      = SelectObject(hdcMem, hBitmap);
            try
            {
                var ptDst  = new POINT  { X = x, Y = y };
                var sz     = new WSIZE  { W = bmp.Width, H = bmp.Height };
                var ptSrc  = new POINT  { X = 0, Y = 0 };
                var blend  = new BLENDFUNCTION { BlendOp = AC_SRC_OVER, SourceConstantAlpha = 255, AlphaFormat = AC_SRC_ALPHA };
                UpdateLayeredWindow(Handle, hdcScreen, ref ptDst, ref sz, hdcMem, ref ptSrc, 0, ref blend, ULW_ALPHA);
            }
            finally
            {
                SelectObject(hdcMem, hOld);
                DeleteObject(hBitmap);
                DeleteDC(hdcMem);
                ReleaseDC(IntPtr.Zero, hdcScreen);
            }
        }
    }

    // ── Debug logger ──────────────────────────────────────────────────────────────

    static class DebugLog
    {
        public static bool Enabled { get; private set; }

        public static readonly string LogPath = Path.Combine(
            Path.GetDirectoryName(Application.ExecutablePath)!, "ChessistEngine.log");

        static StreamWriter? _writer;

        [DllImport("kernel32.dll")] static extern bool AllocConsole();

        public static void Init()
        {
            Enabled = true;
            AllocConsole();
            Console.Title = "Chessist Overlay — Debug";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("=== Chessist Overlay Debug ===");
            Console.WriteLine("Reading draw commands from stdin...\n");
            Console.ResetColor();
        }

        public static void OpenLogFile()
        {
            try
            {
                _writer = new StreamWriter(LogPath, append: false) { AutoFlush = true };
                _writer.WriteLine($"=== Chessist Overlay Log — {DateTime.Now:yyyy-MM-dd HH:mm:ss} ===");
            }
            catch { }
        }

        public static void Write(string text, ConsoleColor conColor = ConsoleColor.White)
        {
            _writer?.WriteLine($"[{DateTime.Now:HH:mm:ss.fff}]  {text}");
            if (Enabled)
            {
                Console.ForegroundColor = conColor;
                Console.WriteLine(text);
                Console.ResetColor();
            }
        }

        public static void Connect()    => Write("client connected",    ConsoleColor.Yellow);
        public static void Disconnect() => Write("client disconnected", ConsoleColor.Red);

        static int      _msgCount;
        static int      _windowCount;
        static DateTime _window = DateTime.UtcNow;

        public static void Message(string type, int bytes)
        {
            if (!Enabled) return;
            _msgCount++;
            _windowCount++;

            var now  = DateTime.UtcNow;
            var secs = (now - _window).TotalSeconds;
            double rate = 0;
            if (secs >= 1.0)
            {
                rate         = _windowCount / secs;
                _window      = now;
                _windowCount = 0;
            }

            var color = type switch
            {
                "evaluate"     => ConsoleColor.Green,
                "positionOnly" => ConsoleColor.DarkGray,
                _              => ConsoleColor.White,
            };
            Console.ForegroundColor = color;
            string rateStr = rate > 0 ? $"  [{rate:F1} msg/s]" : "";
            Console.WriteLine($"[{now:HH:mm:ss.fff}] #{_msgCount,5}  {type,-14} {bytes,5}B{rateStr}");
            Console.ResetColor();
        }

        static DateTime _lastPosLog = DateTime.MinValue;

        public static void Position(int physX, int physY, int physW, int physH, int originX, int originY, double viewX, double viewY, double dpr)
        {
            var now = DateTime.UtcNow;
            bool throttle = (now - _lastPosLog).TotalSeconds >= 1.0;
            if (!throttle && !Enabled) return;
            if (throttle) _lastPosLog = now;

            string text = $"board  phys=({physX},{physY} {physW}x{physH})  origin=({originX},{originY})  view=({viewX:F1},{viewY:F1})  dpr={dpr:F2}";
            Write(text, ConsoleColor.DarkCyan);
        }
    }

    // ── Entry point ───────────────────────────────────────────────────────────────

    static class Program
    {
        static OverlayForm? _overlay;

        [STAThread]
        static void Main(string[] args)
        {
            bool debug = Array.Exists(args, a => a.Equals("-debug", StringComparison.OrdinalIgnoreCase));
            if (debug) DebugLog.Init();
            DebugLog.OpenLogFile();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            _overlay = new OverlayForm();

            // Background thread reads newline-delimited JSON draw commands from stdin.
            var reader = new Thread(StdinLoop) { IsBackground = true, Name = "StdinReader" };
            reader.Start();

            _overlay.Show();
            Application.Run();
        }

        static void StdinLoop()
        {
            var ser = new System.Runtime.Serialization.Json.DataContractJsonSerializer(typeof(WsMsg));
            string? line;
            var stdin = Console.In;
            while ((line = stdin.ReadLine()) != null)
            {
                if (line.Length == 0) continue;
                WsMsg msg;
                try
                {
                    using var ms = new MemoryStream(Encoding.UTF8.GetBytes(line));
                    msg = (WsMsg)ser.ReadObject(ms)!;
                }
                catch { continue; }

                if (msg.Type == "quit") { Application.Exit(); return; }

                var ov = _overlay;
                if (ov != null && !ov.IsDisposed)
                {
                    try { ov.BeginInvoke((Action)(() => ov.Apply(msg))); }
                    catch { /* form closing */ }
                }
            }
            // stdin closed (parent exited) → quit
            Application.Exit();
        }
    }
}
