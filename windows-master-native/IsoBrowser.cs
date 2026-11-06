using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
namespace MoOLVaMaster {
sealed class IsoBrowser:Form {
 readonly WebView2 browser=new WebView2(); readonly Label status=new Label(); readonly ProgressBar bar=new ProgressBar(); readonly Button cancel=new Button(),resume=new Button(); CoreWebView2DownloadOperation active; DateTime started; long initialBytes; readonly string screenshot,downloadFolder; readonly Action<string> onCompleted; readonly bool liveTest; bool initializing;
 public bool Initialized{get;private set;}
 public IsoBrowser(string version,string folder,Action<string> completed,string smokeScreenshot=null,bool live=false) {
  screenshot=smokeScreenshot; downloadFolder=folder;onCompleted=completed;liveTest=live; Text="MoOLVa — ISO Windows "+version;Size=new Size(1120,800);MinimumSize=new Size(850,620);StartPosition=FormStartPosition.CenterParent;
  var top=new Label{Dock=DockStyle.Top,Height=45,Text="Выберите выпуск и язык на странице Microsoft. Затем нажмите кнопку загрузки ISO.",TextAlign=ContentAlignment.MiddleLeft,Padding=new Padding(12,0,0,0)};
  var bottom=new Panel{Dock=DockStyle.Bottom,Height=100};status.SetBounds(12,5,760,27);status.Text="Ожидание загрузки";bar.SetBounds(12,38,650,22);cancel.SetBounds(680,33,150,32);cancel.Text="Отменить";resume.SetBounds(840,33,150,32);resume.Text="Продолжить";bottom.Controls.AddRange(new Control[]{status,bar,cancel,resume});bottom.AutoScroll=true;
  browser.Dock=DockStyle.Fill;Controls.Add(browser);Controls.Add(bottom);Controls.Add(top);
  cancel.Click+=(s,e)=>{if(active!=null)active.Cancel();};resume.Click+=(s,e)=>{try{if(active!=null&&active.CanResume)active.Resume();else MessageBox.Show("Продолжение недоступно. Получите новую ссылку на странице Microsoft.");}catch(Exception ex){MessageBox.Show(ex.Message);}};
  FormClosing+=(s,e)=>{if(active!=null&&active.State==CoreWebView2DownloadState.InProgress){e.Cancel=true;MessageBox.Show("Дождитесь завершения или отмените загрузку.");}};
  Shown+=async(s,e)=>{if(initializing)return;initializing=true;try {
   string profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MoOLVa","WebView2");var env=await CoreWebView2Environment.CreateAsync(null,profile);await browser.EnsureCoreWebView2Async(env);Initialized=true;
   browser.CoreWebView2.DownloadStarting+=OnDownload;
   browser.CoreWebView2.NewWindowRequested+=(o,eventArgs)=>{eventArgs.Handled=true;if(Rules.MicrosoftLink(eventArgs.Uri))browser.CoreWebView2.Navigate(eventArgs.Uri);else MessageBox.Show("Переход к стороннему сайту не выполнен.");};
   // Microsoft serves its ISO selector to non-Windows clients; this compatibility mode requests the official ISO page.
   if(version=="10")browser.CoreWebView2.Settings.UserAgent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
   if(screenshot!=null && liveTest){
    var done=new TaskCompletionSource<CoreWebView2NavigationCompletedEventArgs>();browser.CoreWebView2.NavigationCompleted+=(o,eventArgs)=>done.TrySetResult(eventArgs);
    browser.CoreWebView2.Navigate(version=="10"?"https://www.microsoft.com/ru-ru/software-download/windows10ISO":"https://www.microsoft.com/ru-ru/software-download/windows11");
    var finished=await Task.WhenAny(done.Task,Task.Delay(30000));if(finished!=done.Task){File.WriteAllText(screenshot+".status.txt","TIMEOUT: Microsoft page");Close();return;}
    var nav=await done.Task;await Task.Delay(1500);string title=await browser.CoreWebView2.ExecuteScriptAsync("document.title");File.WriteAllText(screenshot+".status.txt","NavigationSuccess="+nav.IsSuccess+"; WebError="+nav.WebErrorStatus+"; Title="+title);
    string elements=await browser.CoreWebView2.ExecuteScriptAsync("JSON.stringify(Array.from(document.querySelectorAll('select,button')).map(x=>({tag:x.tagName,id:x.id,name:x.name,text:(x.innerText||'').slice(0,100),options:x.options?Array.from(x.options).map(o=>({value:o.value,text:o.text})):[]})))");File.WriteAllText(screenshot+".elements.txt",elements);
    using(var file=File.Create(screenshot))await browser.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,file);Close();
   } else if(screenshot!=null){browser.CoreWebView2.Navigate("about:blank");await Task.Delay(1000);using(var img=new Bitmap(Width,Height)){DrawToBitmap(img,new Rectangle(0,0,img.Width,img.Height));img.Save(screenshot,System.Drawing.Imaging.ImageFormat.Png);}Close();}
   else browser.CoreWebView2.Navigate(version=="10"?"https://www.microsoft.com/ru-ru/software-download/windows10ISO":"https://www.microsoft.com/ru-ru/software-download/windows11");
  }catch(Exception ex){status.Text="Не удалось открыть встроенную страницу Microsoft.";if(screenshot!=null){File.WriteAllText(screenshot+".error.txt",ex.ToString());Close();}else MessageBox.Show("Не удалось открыть встроенную страницу. Убедитесь, что установлен Microsoft Edge WebView2 Runtime.\r\n"+ex.Message);}};
 }
 void OnDownload(object sender,CoreWebView2DownloadStartingEventArgs e){
  if(active!=null && active.State==CoreWebView2DownloadState.InProgress){e.Cancel=true;MessageBox.Show("Сначала завершите текущую загрузку.");return;}
  Uri u;if(!Uri.TryCreate(e.DownloadOperation.Uri,UriKind.Absolute,out u)||!Rules.MicrosoftLink(u.AbsoluteUri)){e.Cancel=true;MessageBox.Show("Загрузка разрешена только с официальных HTTPS-адресов Microsoft.");return;}
  var deferral=e.GetDeferral();SynchronizationContext.Current.Post(_=>{using(deferral){
   string name=Path.GetFileName(e.ResultFilePath);if(!name.EndsWith(".iso",StringComparison.OrdinalIgnoreCase)){e.Cancel=true;MessageBox.Show("Выберите именно ISO-образ на странице Microsoft.");return;}
   using(var dialog=new SaveFileDialog{FileName=name,InitialDirectory=downloadFolder,Filter="Образы ISO|*.iso",OverwritePrompt=true}){
    if(dialog.ShowDialog(this)!=DialogResult.OK){e.Cancel=true;return;}if(File.Exists(dialog.FileName)){e.Cancel=true;MessageBox.Show("Выберите новое имя: существующий файл не перезаписывается.");return;}
    e.ResultFilePath=dialog.FileName;e.Handled=true;active=e.DownloadOperation;started=DateTime.UtcNow;initialBytes=active.BytesReceived;
    active.BytesReceivedChanged+=(s2,e2)=>UpdateProgress();active.EstimatedEndTimeChanged+=(s2,e2)=>UpdateProgress();active.StateChanged+=(s2,e2)=>OnState();status.Text="Загрузка ISO началась...";
   }
  }},null);
 }
 void UpdateProgress(){if(active==null)return;double total=Convert.ToDouble(active.TotalBytesToReceive),received=Convert.ToDouble(active.BytesReceived);double elapsed=Math.Max(0.1,(DateTime.UtcNow-started).TotalSeconds),speed=Math.Max(0,(received-initialBytes)/elapsed);bar.Value=total>0?Math.Min(100,(int)(received*100/total)):0;string remaining=total>received&&speed>0?TimeSpan.FromSeconds(Math.Min((total-received)/speed,TimeSpan.FromDays(30).TotalSeconds)).ToString(@"hh\:mm\:ss"):"—";status.Text=String.Format("{0:N1} / {1} МБ • {2:N1} МБ/с • осталось {3}",received/1048576.0,total>0?(total/1048576.0).ToString("N1"):"?",speed/1048576.0,remaining);}
 void OnState(){if(active==null)return;if(active.State==CoreWebView2DownloadState.Completed){bar.Value=100;if(onCompleted!=null)onCompleted(active.ResultFilePath);status.Text="ISO загружен. Проверьте контрольную сумму в MoOLVa.";MessageBox.Show("ISO сохранён: "+active.ResultFilePath);}
 else if(active.State==CoreWebView2DownloadState.Interrupted){status.Text="Загрузка прервана: "+active.InterruptReason+(active.CanResume?". Можно продолжить.":". Получите новую ссылку.");}}
}
}
