using System;
using System.IO;
using System.Reflection;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace MoOLVaMaster {
static class Bootstrap {
 static readonly Dictionary<string,Assembly> cache=new Dictionary<string,Assembly>();static string folder;
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SetDllDirectory(string path);
 public static void Init(){
  AppDomain.CurrentDomain.AssemblyResolve+=(s,e)=>{string name=new AssemblyName(e.Name).Name;if(name!="Microsoft.Web.WebView2.Core"&&name!="Microsoft.Web.WebView2.WinForms")return null;lock(cache){Assembly a;if(cache.TryGetValue(name,out a))return a;using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream(name+".dll")){if(input==null)return null;using(var ms=new MemoryStream()){input.CopyTo(ms);a=Assembly.Load(ms.ToArray());cache[name]=a;return a;}}}};
  folder=Path.Combine(Path.GetTempPath(),"MoOLVa-WebView-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(folder);string resource=IntPtr.Size==8?"WebView2Loader-x64.dll":"WebView2Loader-x86.dll";using(var src=Assembly.GetExecutingAssembly().GetManifestResourceStream(resource)){if(src==null)throw new FileNotFoundException("WebView2Loader resource missing");using(var dst=File.Create(Path.Combine(folder,"WebView2Loader.dll")))src.CopyTo(dst);}if(!SetDllDirectory(folder))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  AppDomain.CurrentDomain.ProcessExit+=(s,e)=>{try{SetDllDirectory(null);Directory.Delete(folder,true);}catch{}};
 }
}
}
