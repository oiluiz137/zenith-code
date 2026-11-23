// SetIcon.exe <programa.exe> <icone.ico> — troca o ícone principal de um executável (usado no Zenith Code.exe).
// Usa a API de recursos do Windows (BeginUpdateResource/UpdateResource), sem ferramentas externas.
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

static class SetIcon
{
    const uint LOAD_LIBRARY_AS_DATAFILE = 0x2;
    static readonly IntPtr RT_ICON = (IntPtr)3;
    static readonly IntPtr RT_GROUP_ICON = (IntPtr)14;

    delegate bool EnumNameProc(IntPtr module, IntPtr type, IntPtr name, IntPtr param);
    delegate bool EnumLangProc(IntPtr module, IntPtr type, IntPtr name, ushort lang, IntPtr param);

    [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Unicode)] static extern IntPtr LoadLibraryEx(string file, IntPtr reserved, uint flags);
    [DllImport("kernel32", SetLastError = true)] static extern bool FreeLibrary(IntPtr module);
    [DllImport("kernel32", SetLastError = true)] static extern bool EnumResourceNames(IntPtr module, IntPtr type, EnumNameProc proc, IntPtr param);
    [DllImport("kernel32", SetLastError = true)] static extern bool EnumResourceLanguages(IntPtr module, IntPtr type, IntPtr name, EnumLangProc proc, IntPtr param);
    [DllImport("kernel32", SetLastError = true, CharSet = CharSet.Unicode)] static extern IntPtr BeginUpdateResource(string file, bool deleteExisting);
    [DllImport("kernel32", SetLastError = true)] static extern bool UpdateResource(IntPtr update, IntPtr type, IntPtr name, ushort lang, byte[] data, uint size);
    [DllImport("kernel32", SetLastError = true)] static extern bool EndUpdateResource(IntPtr update, bool discard);

    static int Main(string[] args)
    {
        if (args.Length != 2) { Console.Error.WriteLine("uso: SetIcon <exe> <ico>"); return 2; }
        string exe = args[0], ico = args[1];

        // Lê o .ico: cabeçalho, entradas e imagens.
        byte[] icoBytes = File.ReadAllBytes(ico);
        int count = BitConverter.ToUInt16(icoBytes, 4);
        var images = new List<byte[]>();
        var group = new MemoryStream();
        var gw = new BinaryWriter(group);
        gw.Write((ushort)0); gw.Write((ushort)1); gw.Write((ushort)count);
        for (int i = 0; i < count; i++)
        {
            int e = 6 + 16 * i;
            int size = BitConverter.ToInt32(icoBytes, e + 8);
            int offset = BitConverter.ToInt32(icoBytes, e + 12);
            var img = new byte[size];
            Buffer.BlockCopy(icoBytes, offset, img, 0, size);
            images.Add(img);
            // GRPICONDIRENTRY: os 12 primeiros bytes iguais ao .ico, depois o id do recurso (2 bytes).
            gw.Write(icoBytes, e, 12);
            gw.Write((ushort)(i + 1));
        }

        // Descobre o nome e o idioma do grupo de ícones atual do executável.
        IntPtr groupName = IntPtr.Zero; ushort lang = 1033; string groupNameStr = null;
        IntPtr mod = LoadLibraryEx(exe, IntPtr.Zero, LOAD_LIBRARY_AS_DATAFILE);
        if (mod != IntPtr.Zero)
        {
            EnumResourceNames(mod, RT_GROUP_ICON, (m, t, n, p) =>
            {
                if (((long)n >> 16) == 0) groupName = n; else groupNameStr = Marshal.PtrToStringUni(n);
                EnumResourceLanguages(m, t, n, (m2, t2, n2, l, p2) => { lang = l; return false; }, IntPtr.Zero);
                return false;
            }, IntPtr.Zero);
            FreeLibrary(mod);
        }
        IntPtr nameHandle = groupName;
        GCHandle? pinned = null;
        if (groupNameStr != null)
        {
            var chars = (groupNameStr + "\0").ToCharArray();
            var h = GCHandle.Alloc(chars, GCHandleType.Pinned);
            pinned = h;
            nameHandle = h.AddrOfPinnedObject();
        }
        if (nameHandle == IntPtr.Zero) nameHandle = (IntPtr)1;

        IntPtr upd = BeginUpdateResource(exe, false);
        if (upd == IntPtr.Zero) { Console.Error.WriteLine("BeginUpdateResource falhou: " + Marshal.GetLastWin32Error()); return 1; }
        for (int i = 0; i < images.Count; i++)
        {
            if (!UpdateResource(upd, RT_ICON, (IntPtr)(i + 1), lang, images[i], (uint)images[i].Length))
            { Console.Error.WriteLine("UpdateResource (ícone) falhou: " + Marshal.GetLastWin32Error()); EndUpdateResource(upd, true); return 1; }
        }
        byte[] g = group.ToArray();
        if (!UpdateResource(upd, RT_GROUP_ICON, nameHandle, lang, g, (uint)g.Length))
        { Console.Error.WriteLine("UpdateResource (grupo) falhou: " + Marshal.GetLastWin32Error()); EndUpdateResource(upd, true); return 1; }
        if (!EndUpdateResource(upd, false)) { Console.Error.WriteLine("EndUpdateResource falhou: " + Marshal.GetLastWin32Error()); return 1; }
        if (pinned.HasValue) pinned.Value.Free();
        Console.WriteLine("Ícone aplicado em " + exe);
        return 0;
    }
}
