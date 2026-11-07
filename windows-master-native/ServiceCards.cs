using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Printing;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;
using System.Windows.Forms;
namespace MoOLVaMaster {
sealed class ServiceCard {
 public string Id,Created,Computer,Problem,Actions,Remaining,Notes,Snapshot,Events; public bool Reboot;
}
static class ServiceStore {
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
 internal static string Folder { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MoOLVa","ServiceCards"); } }
 internal static void Save(string folder,ServiceCard card){
  if(card==null||!System.Text.RegularExpressions.Regex.IsMatch(card.Id??"",@"\A[0-9a-f]{32}\z"))throw new IOException("Некорректный номер карточки.");
  Directory.CreateDirectory(folder);string target=Path.Combine(folder,card.Id+".json"),temp=target+"."+Guid.NewGuid().ToString("N")+".tmp";
  try{File.WriteAllText(temp,Json.Serialize(card),new UTF8Encoding(false));if(File.Exists(target))File.Replace(temp,target,null);else File.Move(temp,target);}finally{if(File.Exists(temp))File.Delete(temp);}
 }
 internal static ServiceCard Load(string file){return Json.Deserialize<ServiceCard>(File.ReadAllText(file,Encoding.UTF8));}
 internal static bool SelfTest(){string dir=Path.Combine(Path.GetTempPath(),"MoOLVaCardTest-"+Guid.NewGuid().ToString("N"));try{var c=new ServiceCard{Id=Guid.NewGuid().ToString("N"),Problem="Нет звука",Computer="Тест"};Save(dir,c);c.Problem="Исправлено";Save(dir,c);return Load(Path.Combine(dir,c.Id+".json")).Problem=="Исправлено";}finally{if(Directory.Exists(dir))Directory.Delete(dir,true);}}
}
sealed class ServiceCards:Form {
 readonly ListBox list=new ListBox();readonly TextBox computer=new TextBox(),problem=new TextBox(),actions=new TextBox(),remaining=new TextBox(),notes=new TextBox(),snapshot=new TextBox();readonly CheckBox reboot=new CheckBox();readonly string hardware;readonly Func<string> events;ServiceCard current;bool dirty,loading;
 public ServiceCards(string hardwareInfo,Func<string> recentEvents){hardware=hardwareInfo;events=recentEvents;Text="Карточки обслуживания — MoOLVa";Size=new Size(1050,780);MinimumSize=new Size(900,650);StartPosition=FormStartPosition.CenterParent;
  var left=new Panel{Dock=DockStyle.Left,Width=225,Padding=new Padding(8)};Controls.Add(left);list.Dock=DockStyle.Fill;left.Controls.Add(list);var menu=new FlowLayoutPanel{Dock=DockStyle.Bottom,Height=125};left.Controls.Add(menu);var create=Btn("Новая",()=>New());var save=Btn("Сохранить",()=>Save());var reload=Btn("Обновить список",()=>Reload());menu.Controls.AddRange(new Control[]{create,save,reload});
  var body=new Panel{Dock=DockStyle.Fill,AutoScroll=true,Padding=new Padding(12)};Controls.Add(body);body.BringToFront();var flow=new FlowLayoutPanel{Dock=DockStyle.Top,AutoSize=true,WrapContents=false,FlowDirection=FlowDirection.TopDown};body.Controls.Add(flow);
  Add(flow,"Компьютер",computer,55);Add(flow,"Проблема",problem,75);Add(flow,"Выполненные действия и драйверы",actions,100);Add(flow,"Оставшиеся задачи",remaining,75);Add(flow,"Заметки мастера",notes,75);reboot.Text="Требуется перезагрузка";reboot.AutoSize=true;flow.Controls.Add(reboot);reboot.CheckedChanged+=(s,e)=>Changed();Add(flow,"Сведения о системе на момент создания",snapshot,130);
  var row=new FlowLayoutPanel{Width=740,Height=55};flow.Controls.Add(row);row.Controls.Add(Btn("Сохранить TXT",()=>ExportText()));row.Controls.Add(Btn("Печать / PDF",()=>Print()));
  list.SelectedIndexChanged+=(s,e)=>SelectCard();FormClosing+=(s,e)=>{if(!ConfirmDiscard())e.Cancel=true;};Reload();
 }
 Button Btn(string title,Action action){var b=new Button{Text=title,Width=155,Height=38};b.Click+=(s,e)=>action();return b;}
 void Add(FlowLayoutPanel f,string label,TextBox t,int height){f.Controls.Add(new Label{Text=label,AutoSize=true,Margin=new Padding(3,9,3,3)});t.Width=700;t.Height=height;t.Multiline=true;t.ScrollBars=ScrollBars.Vertical;f.Controls.Add(t);t.TextChanged+=(s,e)=>Changed();}
 void Changed(){if(!loading)dirty=true;}
 bool ConfirmDiscard(){return !dirty||MessageBox.Show("Есть несохранённые изменения. Продолжить без сохранения?","Карточка",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)==DialogResult.Yes;}
 void Reload(){loading=true;try{list.Items.Clear();if(Directory.Exists(ServiceStore.Folder))foreach(string path in Directory.GetFiles(ServiceStore.Folder,"*.json")){try{var c=ServiceStore.Load(path);if(c!=null)list.Items.Add(new Item{Card=c});}catch{}}}catch(Exception e){MessageBox.Show(e.Message);}finally{loading=false;}}
 sealed class Item{public ServiceCard Card;public override string ToString(){return (Card.Created??"")+" — "+(Card.Computer??"").Replace("\r"," ").Replace("\n"," ");}}
 void SelectCard(){if(loading)return;if(!ConfirmDiscard()){loading=true;list.ClearSelected();loading=false;return;}var item=list.SelectedItem as Item;if(item==null)return;LoadCard(item.Card);}
 void LoadCard(ServiceCard c){loading=true;current=c;computer.Text=c.Computer??"";problem.Text=c.Problem??"";actions.Text=c.Actions??"";remaining.Text=c.Remaining??"";notes.Text=c.Notes??"";snapshot.Text=c.Snapshot??"";reboot.Checked=c.Reboot;dirty=false;loading=false;}
 void New(){if(!ConfirmDiscard())return;LoadCard(new ServiceCard{Id=Guid.NewGuid().ToString("N"),Created=DateTime.Now.ToString("yyyy-MM-dd HH:mm"),Computer="Новый компьютер",Snapshot=hardware});dirty=true;}
 bool Save(){if(current==null){MessageBox.Show("Создайте или выберите карточку.");return false;}try{current.Computer=computer.Text;current.Problem=problem.Text;current.Actions=actions.Text;current.Remaining=remaining.Text;current.Notes=notes.Text;current.Snapshot=snapshot.Text;current.Reboot=reboot.Checked;current.Events=events();ServiceStore.Save(ServiceStore.Folder,current);dirty=false;Reload();MessageBox.Show("Карточка сохранена на этом компьютере.");return true;}catch(Exception e){MessageBox.Show("Не удалось сохранить: "+e.Message);return false;}}
 string Report(){return "MoOLVa Windows Master — отчёт об обслуживании\r\nДата: "+current.Created+"\r\nКомпьютер: "+computer.Text+"\r\n\r\nПроблема:\r\n"+problem.Text+"\r\n\r\nВыполнено:\r\n"+actions.Text+"\r\n\r\nОсталось:\r\n"+remaining.Text+"\r\n\r\nПерезагрузка: "+(reboot.Checked?"требуется":"не отмечена")+"\r\n\r\nЗаметки:\r\n"+notes.Text+"\r\n\r\nСведения о системе:\r\n"+snapshot.Text+"\r\n\r\nСобытия текущего сеанса:\r\n"+events();}
 void ExportText(){if(current==null){MessageBox.Show("Выберите карточку.");return;}using(var d=new SaveFileDialog{FileName="MoOLVa-Report.txt",Filter="Текстовый файл|*.txt"})if(d.ShowDialog()==DialogResult.OK)try{File.WriteAllText(d.FileName,Report(),new UTF8Encoding(true));}catch(Exception e){MessageBox.Show(e.Message);}}
 void Print(){if(current==null){MessageBox.Show("Выберите карточку.");return;}string text=Report();int position=0;using(var doc=new PrintDocument())using(var dialog=new PrintDialog{Document=doc,UseEXDialog=true}){doc.DocumentName="MoOLVa — отчёт";doc.PrintPage+=(s,e)=>{using(var font=new Font("Arial",10)){int chars,lines;e.Graphics.MeasureString(text.Substring(position),font,e.MarginBounds.Size,StringFormat.GenericTypographic,out chars,out lines);if(chars<=0)throw new IOException("Страница слишком мала для печати.");e.Graphics.DrawString(text.Substring(position,chars),font,Brushes.Black,e.MarginBounds,StringFormat.GenericTypographic);position+=chars;e.HasMorePages=position<text.Length;}};if(dialog.ShowDialog(this)==DialogResult.OK)try{doc.Print();}catch(Exception e){MessageBox.Show("Не удалось напечатать: "+e.Message);}}}
}
}
