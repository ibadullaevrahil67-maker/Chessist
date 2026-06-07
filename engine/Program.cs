// Chessist Engine — C# / .NET 4.8 / GDI+
// Transparent overlay window + integrated Stockfish engine.
// WebSocket server on ws://127.0.0.1:27301
// Build:  dotnet build -c Release
//         output: overlay\bin\Release\net48\ChessistEngine.exe

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
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

    // Eval result broadcast to extension clients
    [DataContract] class EvalData
    {
        [DataMember(Name = "depth")]                                 public int      Depth;
        [DataMember(Name = "cp",           EmitDefaultValue = false)] public int?    Cp;
        [DataMember(Name = "mate",         EmitDefaultValue = false)] public int?    Mate;
        [DataMember(Name = "bestMove",     EmitDefaultValue = false)] public string? BestMove;
        [DataMember(Name = "pv",           EmitDefaultValue = false)] public string[]? Pv;
        [DataMember(Name = "nps",          EmitDefaultValue = false)] public long?   Nps;
        [DataMember(Name = "multipv")]                               public int      Multipv = 1;
        [DataMember(Name = "multiPvMoves", EmitDefaultValue = false)] public string[]? MultiPvMoves;
        [DataMember(Name = "fen",          EmitDefaultValue = false)] public string? Fen;
        [DataMember(Name = "turn",         EmitDefaultValue = false)] public string? Turn;
    }

    [DataContract] class EvalResponse
    {
        [DataMember(Name = "type")] public string  Type = "eval";
        [DataMember(Name = "data")] public EvalData? Data;
    }

    [DataContract] class EngineStatusMsg
    {
        [DataMember(Name = "type")]                                public string  Type = "engine_status";
        [DataMember(Name = "status")]                              public string? Status;
        [DataMember(Name = "message", EmitDefaultValue = false)]   public string? Message;
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

    // ── Stockfish manager ─────────────────────────────────────────────────────────

    sealed class StockfishManager : IDisposable
    {
        static readonly string[] _sfCandidates =
        {
            "stockfish.exe",
            @"stockfish\stockfish.exe",
            @"C:\Program Files\Stockfish\stockfish.exe",
            @"C:\Program Files (x86)\Stockfish\stockfish.exe",
            @"C:\stockfish\stockfish.exe",
        };

        Process?  _sf;
        StreamWriter? _sfIn;
        Thread?   _readerThread;
        volatile bool   _running;
        volatile bool   _isDisposing;
        volatile string? _currentFen;
        volatile string? _currentTurn;
        volatile int    _currentMultiPv = 1;
        volatile int    _lastMultiPv    = 1;

        // Multi-PV buffering: depth → (multipv slot → EvalData)
        readonly Dictionary<int, Dictionary<int, EvalData>> _pvBuf = new();
        readonly object _pvLock = new();

        // Serializers
        static readonly DataContractJsonSerializer _evalSer   = new(typeof(EvalResponse));
        static readonly DataContractJsonSerializer _statusSer = new(typeof(EngineStatusMsg));

        public Func<string, Task>? BroadcastAsync;

        public bool TryStart()
        {
            string? path = FindStockfish();
            if (path == null)
            {
                DebugLog.Write("StockfishManager: stockfish.exe not found — attempting download");
                path = DownloadStockfishAsync().GetAwaiter().GetResult();
                if (path == null) return false;
            }

            DebugLog.Write($"StockfishManager: starting {path}");
            try
            {
                _sf = new Process
                {
                    StartInfo = new ProcessStartInfo(path)
                    {
                        UseShellExecute        = false,
                        RedirectStandardInput  = true,
                        RedirectStandardOutput = true,
                        RedirectStandardError  = true,
                        CreateNoWindow         = true,
                    }
                };
                _sf.Start();
                _sfIn = _sf.StandardInput;
                _sfIn.AutoFlush = true;

                // UCI handshake
                _sfIn.WriteLine("uci");
                string? line;
                while ((line = _sf.StandardOutput.ReadLine()) != null)
                {
                    if (line == "uciok") break;
                }
                _sfIn.WriteLine("setoption name MultiPV value 1");
                _sfIn.WriteLine("isready");
                while ((line = _sf.StandardOutput.ReadLine()) != null)
                {
                    if (line == "readyok") break;
                }

                _running = true;
                _readerThread = new Thread(ReaderLoop) { IsBackground = true, Name = "StockfishReader" };
                _readerThread.Start();

                DebugLog.Write("StockfishManager: engine ready");
                SendStatus("ready");
                BroadcastBootstrapStatus(BroadcastAsync, false);
                return true;
            }
            catch (Exception ex)
            {
                DebugLog.Write($"StockfishManager: failed to start — {ex.Message}");
                SendStatus("error", ex.Message);
                return false;
            }
        }

        static string? FindStockfish()
        {
            string exeDir = Path.GetDirectoryName(Application.ExecutablePath) ?? ".";

            foreach (var candidate in _sfCandidates)
            {
                string full = Path.IsPathRooted(candidate)
                    ? candidate
                    : Path.GetFullPath(Path.Combine(exeDir, candidate));
                if (File.Exists(full)) return full;
            }

            // Search PATH
            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (var dir in pathEnv.Split(';'))
            {
                string t = dir.Trim();
                if (t.Length == 0) continue;
                try
                {
                    string full = Path.Combine(t, "stockfish.exe");
                    if (File.Exists(full)) return full;
                }
                catch { }
            }
            return null;
        }

        async Task<string?> DownloadStockfishAsync()
        {
            try
            {
                SendStatus("downloading", "Stockfish: connecting...");
                var exeDir = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location)!;
                var destPath = Path.Combine(exeDir, "stockfish.exe");

                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("User-Agent", "ChessistEngine/1.0");

                var json = await http.GetStringAsync(
                    "https://api.github.com/repos/official-stockfish/Stockfish/releases/latest");

                var url = System.Text.RegularExpressions.Regex.Matches(json,
                    @"""browser_download_url""\s*:\s*""([^""]+\.zip)""")
                    .Cast<System.Text.RegularExpressions.Match>()
                    .Select(m => m.Groups[1].Value)
                    .Where(u => u.IndexOf("windows", StringComparison.OrdinalIgnoreCase) >= 0)
                    .OrderByDescending(u => u.IndexOf("avx2", StringComparison.OrdinalIgnoreCase) >= 0 ? 1 : 0)
                    .FirstOrDefault();

                if (url == null)
                {
                    SendStatus("error", "Stockfish: no Windows asset found in release");
                    return null;
                }

                SendStatus("downloading", "Stockfish: downloading...");
                var tmpZip = Path.Combine(Path.GetTempPath(), "stockfish_dl.zip");
                using (var resp = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead))
                {
                    resp.EnsureSuccessStatusCode();
                    long? total = resp.Content.Headers.ContentLength;
                    using var src = await resp.Content.ReadAsStreamAsync();
                    using var dst = new FileStream(tmpZip, FileMode.Create, FileAccess.Write, FileShare.None);
                    var buf = new byte[81920];
                    long downloaded = 0;
                    int lastPct = -1;
                    int n;
                    while ((n = await src.ReadAsync(buf, 0, buf.Length)) > 0)
                    {
                        await dst.WriteAsync(buf, 0, n);
                        downloaded += n;
                        if (total > 0)
                        {
                            int pct = (int)(downloaded * 100 / total.Value);
                            if (pct != lastPct && pct % 5 == 0)
                            {
                                lastPct = pct;
                                SendStatus("downloading", $"Stockfish: {pct}%");
                            }
                        }
                    }
                }

                var tmpDir = Path.Combine(Path.GetTempPath(), "stockfish_extracted");
                if (Directory.Exists(tmpDir)) Directory.Delete(tmpDir, true);
                ZipFile.ExtractToDirectory(tmpZip, tmpDir);

                var sfExe = Directory.EnumerateFiles(tmpDir, "*.exe", SearchOption.AllDirectories)
                    .FirstOrDefault(f => Path.GetFileName(f).StartsWith("stockfish", StringComparison.OrdinalIgnoreCase));

                if (sfExe == null)
                {
                    SendStatus("error", "Stockfish: exe not found in downloaded zip");
                    return null;
                }

                File.Copy(sfExe, destPath, overwrite: true);
                try { File.Delete(tmpZip); Directory.Delete(tmpDir, true); } catch { }

                SendStatus("ready", "Stockfish ready");
                DebugLog.Write($"StockfishManager: downloaded stockfish to {destPath}");
                return destPath;
            }
            catch (Exception ex)
            {
                SendStatus("error", $"Stockfish download failed: {ex.Message}");
                DebugLog.Write($"StockfishManager: download error: {ex.Message}");
                return null;
            }
        }

        public void BroadcastBootstrapStatus(Func<string, Task>? broadcast, bool extensionConnected)
        {
            if (broadcast == null) return;
            bool sfOk = _running && _sf != null && !_sf.HasExited;
            var msg = $"{{\"type\":\"bootstrap_status\",\"stockfishOk\":{sfOk.ToString().ToLower()},\"extensionConnected\":{extensionConnected.ToString().ToLower()}}}";
            _ = broadcast(msg);
        }

        public void Evaluate(string fen, int depth, int multiPv)
        {
            if (!_running || _sfIn == null) return;

            // Stop current analysis and give Stockfish a moment to flush
            _sfIn.WriteLine("stop");
            Thread.Sleep(20);

            _currentFen  = fen;
            var parts    = fen.Split(' ');
            _currentTurn = parts.Length > 1 ? parts[1] : "w";
            _currentMultiPv = multiPv > 0 ? multiPv : 1;
            lock (_pvLock) _pvBuf.Clear();

            if (_currentMultiPv != _lastMultiPv)
            {
                _sfIn.WriteLine($"setoption name MultiPV value {_currentMultiPv}");
                _lastMultiPv = _currentMultiPv;
            }

            _sfIn.WriteLine($"position fen {fen}");
            _sfIn.WriteLine($"go depth {depth}");
        }

        public void Stop()
        {
            if (_running) _sfIn?.WriteLine("stop");
        }

        public void SetOption(string name, string value)
        {
            if (!_running || _sfIn == null) return;
            _sfIn.WriteLine($"setoption name {name} value {value}");
            if (name.Equals("MultiPV", StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(value, out int n))
            {
                _currentMultiPv = n;
                _lastMultiPv    = n;
            }
        }

        void ReaderLoop()
        {
            try
            {
                string? line;
                while (_running && _sf != null && (line = _sf.StandardOutput.ReadLine()) != null)
                    ParseLine(line);
            }
            catch { }
            finally
            {
                _running = false;
                DebugLog.Write("StockfishManager: reader loop exited");
                if (!_isDisposing)
                {
                    DebugLog.Write("StockfishManager: unexpected exit, restarting in 1s");
                    Thread.Sleep(1000);
                    Task.Run(() => TryStart());
                }
            }
        }

        void ParseLine(string line)
        {
            if (line.StartsWith("info "))
                ParseInfo(line);
            // bestmove just confirms analysis complete; eval is already sent via info lines
        }

        void ParseInfo(string line)
        {
            var tokens = line.Split(' ');
            int depth = 0, multipv = 1;
            int cp = 0;  bool hasCp   = false;
            int mate = 0; bool hasMate = false;
            long nps = 0;
            var pv = new List<string>();
            bool inPv = false;

            for (int i = 1; i < tokens.Length; i++)
            {
                switch (tokens[i])
                {
                    case "depth":
                        if (++i < tokens.Length) int.TryParse(tokens[i], out depth);
                        break;
                    case "multipv":
                        if (++i < tokens.Length) int.TryParse(tokens[i], out multipv);
                        break;
                    case "nps":
                        if (++i < tokens.Length) long.TryParse(tokens[i], out nps);
                        break;
                    case "score":
                        inPv = false;
                        if (++i < tokens.Length)
                        {
                            if (tokens[i] == "cp" && ++i < tokens.Length)
                                { hasCp = true; int.TryParse(tokens[i], out cp); }
                            else if (tokens[i] == "mate" && ++i < tokens.Length)
                                { hasMate = true; int.TryParse(tokens[i], out mate); }
                        }
                        break;
                    case "pv":
                        inPv = true;
                        break;
                    default:
                        if (inPv) pv.Add(tokens[i]);
                        break;
                }
            }

            if (depth <= 0 || (!hasCp && !hasMate)) return;

            var slot = new EvalData
            {
                Depth   = depth,
                Cp      = hasCp   ? (int?)cp   : null,
                Mate    = hasMate  ? (int?)mate : null,
                Pv      = pv.Count > 0 ? pv.ToArray() : null,
                Nps     = nps > 0 ? (long?)nps : null,
                Multipv = multipv,
                Fen     = _currentFen,
                Turn    = _currentTurn,
            };

            EvalData? toSend = null;
            lock (_pvLock)
            {
                if (!_pvBuf.TryGetValue(depth, out var depthBuf))
                    _pvBuf[depth] = depthBuf = new Dictionary<int, EvalData>();
                depthBuf[multipv] = slot;

                int expected = _currentMultiPv;
                if (depthBuf.Count >= expected && depthBuf.TryGetValue(1, out var s1))
                {
                    toSend = new EvalData
                    {
                        Depth    = s1.Depth,
                        Cp       = s1.Cp,
                        Mate     = s1.Mate,
                        BestMove = s1.Pv?.Length > 0 ? s1.Pv[0] : null,
                        Pv       = s1.Pv,
                        Nps      = s1.Nps,
                        Multipv  = expected,
                        Fen      = s1.Fen,
                        Turn     = s1.Turn,
                    };
                    if (expected > 1)
                    {
                        var alts = new List<string>();
                        for (int s = 2; s <= expected; s++)
                            if (depthBuf.TryGetValue(s, out var sn) && sn.Pv?.Length > 0)
                                alts.Add(sn.Pv[0]);
                        toSend.MultiPvMoves = alts.Count > 0 ? alts.ToArray() : null;
                    }
                }
            }

            if (toSend != null)
                Task.Run(() => FireEval(toSend));
        }

        void FireEval(EvalData data)
        {
            var json = Serialize(_evalSer, new EvalResponse { Data = data });
            BroadcastAsync?.Invoke(json);
        }

        void SendStatus(string status, string? message = null)
        {
            var json = Serialize(_statusSer, new EngineStatusMsg { Status = status, Message = message });
            BroadcastAsync?.Invoke(json);
        }

        static string Serialize<T>(DataContractJsonSerializer ser, T obj)
        {
            using var ms = new MemoryStream();
            ser.WriteObject(ms, obj);
            return Encoding.UTF8.GetString(ms.ToArray());
        }

        public void Dispose()
        {
            _isDisposing = true;
            _running = false;
            try { _sfIn?.WriteLine("quit"); } catch { }
            try { _sf?.Kill(); } catch { }
            _sf?.Dispose();
            _sfIn?.Dispose();
        }
    }

    // ── System tray ───────────────────────────────────────────────────────────────

    sealed class TrayApp : IDisposable
    {
        readonly NotifyIcon _icon;
        SettingsForm? _settingsForm;

        public TrayApp()
        {
            Icon ico;
            try
            {
                string iconPath = Path.Combine(
                    Path.GetDirectoryName(Application.ExecutablePath)!,
                    "..", "..", "..", "..", "icons", "icon16.png");
                using var bmp = new Bitmap(iconPath);
                ico = Icon.FromHandle(bmp.GetHicon());
            }
            catch { ico = SystemIcons.Application; }

            var menu = new ContextMenuStrip();
            var panelItem = new ToolStripMenuItem("Open Panel");
            panelItem.Click += (_, _) =>
            {
                if (_settingsForm == null || _settingsForm.IsDisposed)
                    _settingsForm = new SettingsForm();
                _settingsForm.Show();
                _settingsForm.BringToFront();
            };
            menu.Items.Insert(0, panelItem);
            menu.Items.Insert(1, new ToolStripSeparator());
            menu.Items.Add("View Logs", null, (_, _) =>
            {
                try { Process.Start(new ProcessStartInfo(DebugLog.LogPath) { UseShellExecute = true }); }
                catch { }
            });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Quit Chessist Engine", null, (_, _) => Application.Exit());

            _icon = new NotifyIcon
            {
                Icon             = ico,
                Text             = "Chessist Engine",
                ContextMenuStrip = menu,
                Visible          = true,
            };
        }

        public void Dispose() { _icon.Visible = false; _icon.Dispose(); }
    }

    // ── Settings panel (WebView2 floating window) ─────────────────────────────────

    sealed class SettingsForm : Form
    {
        Microsoft.Web.WebView2.WinForms.WebView2 _webView = null!;

        public SettingsForm()
        {
            Text            = "Chessist Panel";
            Width           = 420;
            Height          = 520;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox     = false;
            ShowInTaskbar   = false;
            StartPosition   = FormStartPosition.Manual;

            var screen = System.Windows.Forms.Screen.PrimaryScreen!.WorkingArea;
            Location = new System.Drawing.Point(screen.Right - Width - 20, screen.Bottom - Height - 20);
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);

            _webView = new Microsoft.Web.WebView2.WinForms.WebView2 { Dock = DockStyle.Fill };
            _webView.CoreWebView2InitializationCompleted += (s, ev) =>
            {
                if (!ev.IsSuccess)
                {
                    MessageBox.Show(
                        "WebView2 runtime not found.\nDownload: https://developer.microsoft.com/microsoft-edge/webview2/",
                        "Chessist", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                _webView.CoreWebView2.Settings.AreDevToolsEnabled = DebugLog.Enabled;

                var uiPath = Path.Combine(
                    Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location)!, "ui");

                if (Directory.Exists(uiPath))
                {
                    _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "chessist.local", uiPath,
                        Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind.Allow);
                    _webView.CoreWebView2.Navigate("https://chessist.local/index.html");
                }
                else
                {
                    _webView.CoreWebView2.NavigateToString(
                        "<html><body style='font-family:sans-serif;padding:20px'>" +
                        "<h2>Chessist Panel</h2>" +
                        "<p>UI not built yet. Run: <code>cd ui &amp;&amp; npm run build</code></p>" +
                        "</body></html>");
                }
            };
            Controls.Add(_webView);
            _webView.EnsureCoreWebView2Async();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (e.CloseReason == CloseReason.UserClosing)
            {
                e.Cancel = true;
                Hide();
            }
            else
            {
                base.OnFormClosing(e);
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
            Console.Title = "Chessist Engine — Debug";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("=== Chessist Engine Debug ===");
            Console.WriteLine($"WebSocket: ws://127.0.0.1:{WsServer.Port}");
            Console.WriteLine("Waiting for connection...\n");
            Console.ResetColor();
        }

        public static void OpenLogFile()
        {
            try
            {
                _writer = new StreamWriter(LogPath, append: false) { AutoFlush = true };
                _writer.WriteLine($"=== Chessist Engine Log — {DateTime.Now:yyyy-MM-dd HH:mm:ss} ===");
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

    // ── WebSocket server ──────────────────────────────────────────────────────────

    sealed class WsServer
    {
        public const int Port = 27301;

        readonly OverlayForm     _overlay;
        readonly StockfishManager _sfManager;
        readonly DataContractJsonSerializer _deser = new(typeof(WsMsg));

        // Track all active connections for broadcasting eval results
        readonly List<(WebSocket ws, SemaphoreSlim lk)> _clients = new();
        readonly object _clientsLock = new();

        static int _extensionClientCount = 0;
        static readonly object _extLock = new();

        public WsServer(OverlayForm overlay, StockfishManager sfManager)
        {
            _overlay   = overlay;
            _sfManager = sfManager;
            _sfManager.BroadcastAsync = BroadcastAsync;
        }

        public async Task RunAsync(CancellationToken ct)
        {
            var listener = new HttpListener();
            listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
            listener.Start();
            ct.Register(listener.Stop);

            while (!ct.IsCancellationRequested)
            {
                HttpListenerContext ctx;
                try { ctx = await listener.GetContextAsync(); }
                catch { break; }

                if (ctx.Request.IsWebSocketRequest)
                    _ = HandleAsync(ctx, ct);
                else if (ctx.Request.RawUrl == "/ping")
                {
                    ctx.Response.StatusCode = 200;
                    ctx.Response.Close();
                }
                else
                    ctx.Response.Abort();
            }
        }

        async Task HandleAsync(HttpListenerContext ctx, CancellationToken ct)
        {
            var wsCtx = await ctx.AcceptWebSocketAsync(null);
            var ws    = wsCtx.WebSocket;
            var lk    = new SemaphoreSlim(1, 1);
            var buf   = new byte[65536];
            bool isExtensionClient = false;

            lock (_clientsLock) _clients.Add((ws, lk));
            DebugLog.Connect();

            // Send current engine status to newly connected client
            _ = Task.Run(() => _sfManager.BroadcastAsync?.Invoke(null!)); // will be filtered below

            try
            {
                while (ws.State == WebSocketState.Open && !ct.IsCancellationRequested)
                {
                    var result = await ws.ReceiveAsync(new ArraySegment<byte>(buf), ct);
                    if (result.MessageType == WebSocketMessageType.Close) break;

                    int len  = result.Count;
                    var json = Encoding.UTF8.GetString(buf, 0, len);

                    WsMsg msg;
                    try
                    {
                        using var ms = new MemoryStream(Encoding.UTF8.GetBytes(json));
                        msg = (WsMsg)_deser.ReadObject(ms)!;
                    }
                    catch { continue; }

                    if (DebugLog.Enabled)
                        DebugLog.Message(msg.Type ?? (msg.PositionOnly ? "positionOnly" : "overlay"), len);

                    // Dispatch based on message type
                    switch (msg.Type)
                    {
                        case "evaluate":
                            _sfManager.Evaluate(
                                msg.Fen ?? "",
                                msg.Depth > 0 ? msg.Depth : 18,
                                msg.MultiPv > 0 ? msg.MultiPv : 1);
                            break;

                        case "stop":
                            _sfManager.Stop();
                            break;

                        case "set_option":
                            if (msg.Name != null && msg.Value != null)
                                _sfManager.SetOption(msg.Name, msg.Value);
                            break;

                        case "identify":
                            if (json.IndexOf("extension", StringComparison.OrdinalIgnoreCase) >= 0 && !isExtensionClient)
                            {
                                isExtensionClient = true;
                                lock (_extLock) _extensionClientCount++;
                                _sfManager.BroadcastBootstrapStatus(BroadcastAsync, _extensionClientCount > 0);
                            }
                            break;

                        default:
                            // Overlay position/visual update
                            _overlay.Apply(msg);
                            break;
                    }
                }
            }
            catch { }
            finally
            {
                lock (_clientsLock) _clients.RemoveAll(c => c.ws == ws);
                if (isExtensionClient)
                {
                    lock (_extLock) _extensionClientCount--;
                    _sfManager.BroadcastBootstrapStatus(BroadcastAsync, _extensionClientCount > 0);
                }
                DebugLog.Disconnect();
                _overlay.Apply(new WsMsg { Visible = false });
                ws.Dispose();
                lk.Dispose();
            }
        }

        public async Task BroadcastAsync(string json)
        {
            if (json == null) return;
            var bytes = Encoding.UTF8.GetBytes(json);

            List<(WebSocket ws, SemaphoreSlim lk)> snapshot;
            lock (_clientsLock) snapshot = new List<(WebSocket, SemaphoreSlim)>(_clients);

            var tasks = new List<Task>(snapshot.Count);
            foreach (var (ws, lk) in snapshot)
                tasks.Add(SendSafeAsync(ws, lk, bytes));

            await Task.WhenAll(tasks);
        }

        static async Task SendSafeAsync(WebSocket ws, SemaphoreSlim lk, byte[] bytes)
        {
            if (ws.State != WebSocketState.Open) return;
            await lk.WaitAsync();
            try
            {
                if (ws.State == WebSocketState.Open)
                    await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch { }
            finally { lk.Release(); }
        }
    }

    // ── Native-messaging host bridge ──────────────────────────────────────────────
    // When Chrome launches ChessistEngine.exe as a native-messaging host it passes
    // the calling extension's origin (chrome-extension://ID/) as an argument.
    // In that mode we skip all UI and run the stdio JSON loop instead.

    static class HostBridge
    {
        static Stream In  => Console.OpenStandardInput();
        static Stream Out => Console.OpenStandardOutput();

        static string? Read()
        {
            var lb = new byte[4];
            int read = 0;
            while (read < 4)
            {
                int n = In.Read(lb, read, 4 - read);
                if (n == 0) return null;
                read += n;
            }
            int len = BitConverter.ToInt32(lb, 0);
            var buf = new byte[len]; read = 0;
            while (read < len)
            {
                int n = In.Read(buf, read, len - read);
                if (n == 0) return null;
                read += n;
            }
            return Encoding.UTF8.GetString(buf);
        }

        static void Write(string json)
        {
            var bytes = Encoding.UTF8.GetBytes(json);
            Out.Write(BitConverter.GetBytes(bytes.Length), 0, 4);
            Out.Write(bytes, 0, bytes.Length);
            Out.Flush();
        }

        static bool IsRunning()
        {
            Mutex? m = null;
            try   { return Mutex.TryOpenExisting("ChessistEngineInstance", out m); }
            catch { return false; }
            finally { m?.Dispose(); }
        }

        static void Launch(bool debug)
        {
            if (IsRunning())
            {
                Write("{\"type\":\"launch_result\",\"success\":true,\"already_running\":true}");
                return;
            }
            try
            {
                var exe = System.Reflection.Assembly.GetExecutingAssembly().Location;
                var psi = new ProcessStartInfo(exe)
                {
                    UseShellExecute = false,
                    CreateNoWindow  = !debug,
                    Arguments       = debug ? "-debug" : "",
                };
                Process.Start(psi);
                Write("{\"type\":\"launch_result\",\"success\":true}");
            }
            catch (Exception ex)
            {
                var msg = ex.Message.Replace("\"", "'");
                Write($"{{\"type\":\"launch_result\",\"success\":false,\"error\":\"{msg}\"}}");
            }
        }

        static void Kill()
        {
            int self = Process.GetCurrentProcess().Id;
            foreach (var p in Process.GetProcessesByName("ChessistEngine"))
            {
                try { if (p.Id != self) p.Kill(); } catch { }
                p.Dispose();
            }
        }

        public static void Run()
        {
            while (true)
            {
                var json = Read();
                if (json == null) break;

                var typeM  = System.Text.RegularExpressions.Regex.Match(json, "\"type\"\\s*:\\s*\"([^\"]+)\"");
                var debugM = System.Text.RegularExpressions.Regex.Match(json, "\"debug\"\\s*:\\s*true");
                string type  = typeM.Success ? typeM.Groups[1].Value : "";
                bool   debug = debugM.Success;

                switch (type)
                {
                    case "launch":  Launch(debug); break;
                    case "restart": Kill(); Thread.Sleep(500); Launch(debug); break;
                    case "kill":    Kill(); break;
                    case "quit":    return;
                }
            }
        }
    }

    // ── Entry point ───────────────────────────────────────────────────────────────

    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            // Host-bridge mode: Chrome passes "chrome-extension://..." as an argument
            bool isHost = Array.Exists(args, a =>
                a.StartsWith("chrome-extension://", StringComparison.OrdinalIgnoreCase) ||
                a.Equals("-host", StringComparison.OrdinalIgnoreCase));

            if (isHost) { HostBridge.Run(); return; }

            // Prevent duplicate normal-mode instances
            bool createdNew;
            var mutex = new Mutex(true, "ChessistEngineInstance", out createdNew);
            if (!createdNew) { mutex.Dispose(); return; }

            bool debug = Array.Exists(args, a => a.Equals("-debug", StringComparison.OrdinalIgnoreCase));
            if (debug) DebugLog.Init();
            DebugLog.OpenLogFile();

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            using var cts     = new CancellationTokenSource();
            using var overlay = new OverlayForm();
            using var tray    = new TrayApp();
            using var sfMgr   = new StockfishManager();
            var wsServer      = new WsServer(overlay, sfMgr);

            Application.ApplicationExit += (_, _) => { cts.Cancel(); mutex.ReleaseMutex(); };

            Task.Run(() => wsServer.RunAsync(cts.Token));
            Task.Run(() => sfMgr.TryStart());

            overlay.Show();
            Application.Run();
            mutex.Dispose();
        }
    }
}
