using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
namespace MoOLVaMaster {
sealed class NativeIsoWizard:Form {
 readonly string version,folder,probePath,screenshot;readonly Action<string> completed;
 readonly WebView2 worker=new WebView2();readonly ComboBox editions=new ComboBox(),languages=new ComboBox(),arch=new ComboBox();readonly Button start=new Button(),pause=new Button(),resume=new Button(),cancel=new Button(),retry=new Button();readonly Label status=new Label(),summary=new Label();readonly ProgressBar bar=new ProgressBar();
 readonly JavaScriptSerializer json=new JavaScriptSerializer();readonly TaskCompletionSource<string> probeResult=new TaskCompletionSource<string>();TaskCompletionSource<bool> handoff;CoreWebView2DownloadOperation active;bool init,loading;DateTime started;long initialBytes;
 sealed class Choice{public string Value,Name;public override string ToString(){return Name;}}
 public bool Initialized{get;private set;}
 public NativeIsoWizard(string v,string destination,Action<string> onComplete,string testOutput=null,string screenshotOutput=null){
  version=v;folder=destination;completed=onComplete;probePath=testOutput;screenshot=screenshotOutput;Text="MoOLVa — загрузить Windows "+v;Size=new Size(860,660);MinimumSize=new Size(780,600);StartPosition=FormStartPosition.CenterParent;BackColor=Color.FromArgb(16,23,36);ForeColor=Color.White;Font=new Font("Segoe UI",10);
  var head=new Label{Text="Скачать Windows "+v,Font=new Font("Segoe UI",19,FontStyle.Bold),Location=new Point(25,18),Size=new Size(750,50),ForeColor=Color.White};Controls.Add(head);
  var eLabel=new Label{Text="Выпуск",Location=new Point(28,85),Size=new Size(500,24)};Controls.Add(eLabel);editions.SetBounds(28,113,760,32);editions.DropDownStyle=ComboBoxStyle.DropDownList;Controls.Add(editions);
  var lLabel=new Label{Text="Язык",Location=new Point(28,160),Size=new Size(500,24)};Controls.Add(lLabel);languages.SetBounds(28,188,760,32);languages.DropDownStyle=ComboBoxStyle.DropDownList;Controls.Add(languages);
  var aLabel=new Label{Text="Разрядность",Location=new Point(28,235),Size=new Size(500,24)};Controls.Add(aLabel);arch.SetBounds(28,263,320,32);arch.DropDownStyle=ComboBoxStyle.DropDownList;arch.Items.Add("64-разрядная (x64)");if(v=="10")arch.Items.Add("32-разрядная (x86)");arch.SelectedIndex=0;Controls.Add(arch);
  start.Text="Скачать ISO";start.SetBounds(28,320,220,45);start.BackColor=Color.FromArgb(255,196,71);start.ForeColor=Color.FromArgb(16,23,36);start.FlatStyle=FlatStyle.Flat;Controls.Add(start);
  retry.Text="Повторить поиск";retry.SetBounds(260,320,175,45);Controls.Add(retry);pause.Text="Пауза";pause.SetBounds(445,320,105,45);Controls.Add(pause);resume.Text="Продолжить";resume.SetBounds(560,320,130,45);Controls.Add(resume);cancel.Text="Отмена";cancel.SetBounds(700,320,90,45);Controls.Add(cancel);
  status.Text="Подключение к источнику...";status.SetBounds(28,390,760,52);status.ForeColor=Color.White;Controls.Add(status);bar.SetBounds(28,455,760,24);Controls.Add(bar);summary.Text="Для скачивания необходим интернет. Выберите папку при запуске загрузки.";summary.SetBounds(28,495,760,65);Controls.Add(summary);
  worker.SetBounds(-5,-5,1,1);worker.TabStop=false;Controls.Add(worker);worker.SendToBack();start.Enabled=false;editions.Enabled=false;languages.Enabled=false;retry.Enabled=false;pause.Enabled=false;resume.Enabled=false;cancel.Enabled=false;
  start.Click+=async(s,e)=>await BeginDownload();retry.Click+=async(s,e)=>await OpenCatalog();pause.Click+=(s,e)=>{try{if(active!=null)active.Pause();}catch(Exception ex){ShowError(ex.Message);}};resume.Click+=(s,e)=>{try{if(active!=null&&active.CanResume)active.Resume();else ShowError("Продолжение недоступно. Повторите выбор образа.");}catch(Exception ex){ShowError(ex.Message);}};cancel.Click+=(s,e)=>{if(active!=null)active.Cancel();};
  editions.SelectedIndexChanged+=async(s,e)=>{if(init&& !loading && editions.SelectedItem!=null)await LoadLanguages();};
  FormClosing+=(s,e)=>{if(active!=null&&active.State==CoreWebView2DownloadState.InProgress){e.Cancel=true;ShowError("Дождитесь завершения скачивания или нажмите «Отмена».");}else if(loading){e.Cancel=true;ShowError("Дождитесь ответа источника.");}};
  Shown+=async(s,e)=>{try{string profile=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MoOLVa","WebView2");var env=await CoreWebView2Environment.CreateAsync(null,profile);await worker.EnsureCoreWebView2Async(env);Initialized=true;worker.CoreWebView2.DownloadStarting+=OnDownload;worker.CoreWebView2.NewWindowRequested+=(o,a)=>{a.Handled=true;if(Rules.MicrosoftLink(a.Uri))worker.CoreWebView2.Navigate(a.Uri);else status.Text="Источник загрузки не прошёл проверку.";};if(v=="10")worker.CoreWebView2.Settings.UserAgent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";await OpenCatalog();
   if(screenshot!=null){using(var image=new Bitmap(Width,Height)){DrawToBitmap(image,new Rectangle(0,0,image.Width,image.Height));image.Save(screenshot,System.Drawing.Imaging.ImageFormat.Png);}Close();}
   else if(probePath!=null){if(languages.Items.Count==0){File.WriteAllText(probePath,"UNAVAILABLE: source did not return language choices");Close();return;}SelectRussian();await BeginDownload();if(await Task.WhenAny(probeResult.Task,Task.Delay(35000))==probeResult.Task)File.WriteAllText(probePath,await probeResult.Task);else File.WriteAllText(probePath,"UNAVAILABLE: download event did not occur");Close();}
  }catch(Exception e){loading=false;status.Text="Не удалось открыть загрузчик: "+e.Message;if(probePath!=null)File.WriteAllText(probePath,"FAILED: "+e.GetType().Name);if(screenshot!=null||probePath!=null)Close();}};
 }
 void ShowError(string text){status.Text=text;if(probePath==null&&screenshot==null)MessageBox.Show(text,"MoOLVa");}
 async Task<string> Eval(string code){return await worker.CoreWebView2.ExecuteScriptAsync(code);}
 async Task<bool> WaitScript(string js,int seconds){for(int i=0;i<seconds*2;i++){await Task.Delay(500);if(IsDisposed)return false;string v=await Eval(js);if(v=="true")return true;}return false;}
 Choice[] Options(string result){var obj=json.DeserializeObject(result) as object[];if(obj==null)return new Choice[0];var choices=new List<Choice>();foreach(var entry in obj){var row=entry as Dictionary<string,object>;if(row==null)continue;string val=Convert.ToString(row["value"]),name=Convert.ToString(row["text"]);if(!String.IsNullOrWhiteSpace(val)&&val!="null"&&!String.IsNullOrWhiteSpace(name))choices.Add(new Choice{Value=val,Name=name.Trim()});}return choices.ToArray();}
 async Task OpenCatalog(){
  if(loading)return;loading=true;init=false;retry.Enabled=false;start.Enabled=false;editions.Enabled=false;languages.Enabled=false;editions.Items.Clear();languages.Items.Clear();status.Text="Получаем список выпусков Windows "+version+"...";
  try{
   var nav=new TaskCompletionSource<CoreWebView2NavigationCompletedEventArgs>();EventHandler<CoreWebView2NavigationCompletedEventArgs> handler=(s,e)=>nav.TrySetResult(e);worker.CoreWebView2.NavigationCompleted+=handler;
   worker.CoreWebView2.Navigate(version=="10"?"https://www.microsoft.com/ru-ru/software-download/windows10ISO":"https://www.microsoft.com/ru-ru/software-download/windows11");
   if(await Task.WhenAny(nav.Task,Task.Delay(30000))!=nav.Task)throw new IOException("Превышено время ответа Microsoft.");var result=await nav.Task;worker.CoreWebView2.NavigationCompleted-=handler;if(!result.IsSuccess)throw new IOException("Источник недоступен: "+result.WebErrorStatus);
   if(!await WaitScript("!!document.querySelector('#product-edition option:not([value=\"null\"])')",25))throw new IOException("Источник не выдал список выпусков. Повторите позже.");
   var values=Options(await Eval("Array.from(document.querySelector('#product-edition').options).map(o=>({value:o.value,text:o.text}))"));if(values.Length==0)throw new IOException("Список выпусков пуст.");foreach(var value in values)editions.Items.Add(value);editions.SelectedIndex=0;editions.Enabled=true;init=true;
  }catch(Exception e){status.Text="Не удалось получить каталог: "+e.Message;retry.Enabled=true;loading=false;return;}
  loading=false;await LoadLanguages();
 }
 async Task LoadLanguages(){
  if(loading||editions.SelectedItem==null)return;loading=true;start.Enabled=false;languages.Enabled=false;languages.Items.Clear();status.Text="Получаем доступные языки...";
  try{string code=json.Serialize(((Choice)editions.SelectedItem).Value);string result=await Eval("(function(){var e=document.getElementById('product-edition'),b=document.getElementById('submit-product-edition');if(!e||!b)return 'missing';e.value="+code+";e.dispatchEvent(new Event('change',{bubbles:true}));b.click();return 'ok';})()");if(!result.Contains("ok"))throw new IOException("Выбор выпуска недоступен.");
   if(!await WaitScript("(document.getElementById('product-languages')||{}).options?.length>1",30))throw new IOException("Источник не предоставил языки. Возможны сетевые ограничения или дополнительные проверки.");
   var values=Options(await Eval("Array.from(document.querySelector('#product-languages').options).map(o=>({value:o.value,text:o.text}))"));if(values.Length==0)throw new IOException("Список языков пуст.");foreach(var value in values)languages.Items.Add(value);SelectRussian();languages.Enabled=true;start.Enabled=true;retry.Enabled=true;status.Text="Выберите язык и разрядность, затем нажмите «Скачать ISO».";
  }catch(Exception e){status.Text="Не удалось получить языки: "+e.Message;retry.Enabled=true;}
  finally{loading=false;}
 }
 void SelectRussian(){int idx=-1;for(int i=0;i<languages.Items.Count;i++){if(languages.Items[i].ToString().IndexOf("русск",StringComparison.OrdinalIgnoreCase)>=0){idx=i;break;}}if(languages.Items.Count>0)languages.SelectedIndex=idx>=0?idx:0;}
 async Task BeginDownload(){
  if(loading||languages.SelectedItem==null)return;handoff=new TaskCompletionSource<bool>();loading=true;start.Enabled=false;editions.Enabled=false;languages.Enabled=false;retry.Enabled=false;status.Text="Получаем ссылку для выбранного языка...";
  try{string code=json.Serialize(((Choice)languages.SelectedItem).Value);string r=await Eval("(function(){var x=document.getElementById('product-languages'),b=document.getElementById('submit-sku');if(!x||!b)return 'missing';x.value="+code+";x.dispatchEvent(new Event('change',{bubbles:true}));b.click();return 'ok';})()");if(!r.Contains("ok"))throw new IOException("Не удалось выбрать язык.");
   bool want32=arch.SelectedIndex==1;bool found=false;
   for(int i=0;i<60;i++){await Task.Delay(500);string js="(function(){var list=Array.from(document.querySelectorAll('a[href]')).filter(x=>x.href.toLowerCase().indexOf('.iso')>=0);var a=list.find(x=>{var name=x.innerText+' '+new URL(x.href).pathname.split('/').pop();return "+(want32?"/(x86|x32|32[-_ ]?(?:разряд|bit))/i.test(name)&&!/(x64|64[-_ ]?(?:разряд|bit))/i.test(name)":"/(x64|64[-_ ]?(?:разряд|bit))/i.test(name)")+";});if(!a)return false;a.click();return true;})()";if(await Eval(js)=="true"){found=true;break;}}
   if(!found)throw new IOException("Источник не выдал ссылку для выбранной разрядности. Возможны дополнительные проверки или выбранный вариант недоступен.");status.Text="Ожидание начала загрузки...";if(await Task.WhenAny(handoff.Task,Task.Delay(30000))!=handoff.Task)throw new IOException("Загрузка не началась. Повторите попытку.");
  }catch(Exception e){status.Text="Не удалось начать загрузку: "+e.Message;retry.Enabled=true;if(probePath!=null)probeResult.TrySetResult("UNAVAILABLE: "+e.Message);}
  finally{loading=false;}
 }
 async void OnDownload(object sender,CoreWebView2DownloadStartingEventArgs e){
  if(handoff!=null)handoff.TrySetResult(true);
  Uri uri;if(!Uri.TryCreate(e.DownloadOperation.Uri,UriKind.Absolute,out uri)||!Rules.MicrosoftLink(uri.AbsoluteUri)){e.Cancel=true;retry.Enabled=true;status.Text="Источник загрузки не прошёл проверку.";if(probePath!=null)probeResult.TrySetResult("FAILED: unexpected download host");return;}
  string name=Path.GetFileName(e.ResultFilePath);if(!name.EndsWith(".iso",StringComparison.OrdinalIgnoreCase)){e.Cancel=true;retry.Enabled=true;status.Text="Источник вернул файл другого типа.";if(probePath!=null)probeResult.TrySetResult("FAILED: suggested name is not ISO");return;}
  if(probePath!=null){e.Cancel=true;string url=uri.AbsoluteUri;probeResult.TrySetResult(await Task.Run(()=>IsoBrowser.ProbeRange(url)));return;}
  var deferral=e.GetDeferral();SynchronizationContext.Current.Post(_=>{using(deferral){using(var d=new SaveFileDialog{FileName=name,InitialDirectory=folder,Filter="ISO-образы|*.iso",OverwritePrompt=true}){
   if(d.ShowDialog(this)!=DialogResult.OK){e.Cancel=true;status.Text="Загрузка отменена.";retry.Enabled=true;return;}if(File.Exists(d.FileName)){e.Cancel=true;ShowError("Выберите новое имя файла: существующий ISO не перезаписывается.");retry.Enabled=true;return;}
   e.ResultFilePath=d.FileName;e.Handled=true;active=e.DownloadOperation;started=DateTime.UtcNow;initialBytes=active.BytesReceived;active.BytesReceivedChanged+=(x,y)=>UpdateProgress();active.StateChanged+=(x,y)=>OnState();pause.Enabled=true;cancel.Enabled=true;status.Text="Скачивание началось...";
  }}},null);
 }
 void UpdateProgress(){if(active==null)return;double bytes=Convert.ToDouble(active.BytesReceived),total=Convert.ToDouble(active.TotalBytesToReceive),sec=Math.Max(.1,(DateTime.UtcNow-started).TotalSeconds),speed=Math.Max(0,(bytes-initialBytes)/sec);bar.Value=total>0?Math.Min(100,(int)(bytes*100/total)):0;string eta=total>bytes&&speed>0?TimeSpan.FromSeconds(Math.Min((total-bytes)/speed,TimeSpan.FromDays(30).TotalSeconds)).ToString(@"hh\:mm\:ss"):"—";status.Text=String.Format("{0:N1} / {1} МБ • {2:N1} МБ/с • осталось {3}",bytes/1048576.0,total>0?(total/1048576.0).ToString("N1"):"?",speed/1048576.0,eta);}
 void OnState(){if(active==null)return;if(active.State==CoreWebView2DownloadState.Completed){bar.Value=100;pause.Enabled=false;cancel.Enabled=false;resume.Enabled=false;status.Text="ISO скачан. Для проверки сравните SHA-256 с официальным значением.";if(completed!=null)completed(active.ResultFilePath);if(probePath==null)MessageBox.Show("Сохранён ISO: "+active.ResultFilePath);}
 else if(active.State==CoreWebView2DownloadState.Interrupted){pause.Enabled=false;resume.Enabled=active.CanResume;cancel.Enabled=false;retry.Enabled=true;status.Text="Загрузка прервана: "+active.InterruptReason+(active.CanResume?". Можно продолжить.":". Повторите выбор образа.");}}
}
}
