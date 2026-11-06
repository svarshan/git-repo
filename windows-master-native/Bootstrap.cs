using System;
using System.IO;
using System.Reflection;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
namespace MoOLVaMaster {
static class Bootstrap {
 static readonly Dictionary<string,Assembly> cache=new Dictionary<string,Assembly>();static string folder;
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool SetDllDirectory(string path);
 static byte[] Digest(byte[] bytes){using(var sha=SHA256.Create())return sha.ComputeHash(bytes);}
 static bool Equal(byte[] a,byte[] b){if(a.Length!=b.Length)return false;int d=0;for(int i=0;i<a.Length;i++)d|=a[i]^b[i];return d==0;}
 public static void Init(){
  AppDomain.CurrentDomain.AssemblyResolve+=(s,e)=>{string name=new AssemblyName(e.Name).Name;if(name!="Microsoft.Web.WebView2.Core"&&name!="Microsoft.Web.WebView2.WinForms")return null;lock(cache){Assembly a;if(cache.TryGetValue(name,out a))return a;using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream(name+".dll")){if(input==null)return null;using(var ms=new MemoryStream()){input.CopyTo(ms);a=Assembly.Load(ms.ToArray());cache[name]=a;return a;}}}};
  string arch=IntPtr.Size==8?"x64":"x86";folder=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MoOLVa","WebView2Loader","1.0.2903.40-"+arch);Directory.CreateDirectory(folder);
  string resource="WebView2Loader-"+arch+".dll",path=Path.Combine(folder,"WebView2Loader.dll");byte[] embedded;
  using(var src=Assembly.GetExecutingAssembly().GetManifestResourceStream(resource)){if(src==null)throw new FileNotFoundException("WebView2Loader resource missing");using(var ms=new MemoryStream()){src.CopyTo(ms);embedded=ms.ToArray();}}
  if(!File.Exists(path)){try{using(var dst=new FileStream(path,FileMode.CreateNew,FileAccess.Write,FileShare.None))dst.Write(embedded,0,embedded.Length);}catch(IOException){if(!File.Exists(path))throw;}}
  if(!Equal(Digest(embedded),Digest(File.ReadAllBytes(path))))throw new InvalidDataException("Проверка компонента WebView2Loader не пройдена.");
  if(!SetDllDirectory(folder))throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
 }
}
}
