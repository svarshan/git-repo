"""Real SQLite and legacy journal regression tests for MoOLVa 3.0.1 Quick Journals."""
import json
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path

import quick31
from web19_bridge import LiveService

class QuickJournal301Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.service=LiveService(Path(self.temp.name)/'journal.sqlite3')
        self.actor={'id':1,'role':'super','venue_id':None,'display_name':'Руководитель'}
        self.venue=self.service.action('create_venue_guided',{
            'setup':{
              'details':{'venue_name':'Столовая 1','kind':'Столовая'},
              'employees':[{'name':'Анна Иванова','position':'Повар',
                            'shift':'Дневная','deputy':''}],
              'journals':[{'code':'fridge','cadence':'daily','clock':'09:00',
                           'start_on':date.today().isoformat(),
                           'owner':'Анна Иванова','employee':'Анна Иванова'}]
            }
        },self.actor)['venue']

    def tearDown(self):
        self.temp.cleanup()

    def act(self,name,**args):
        return self.service.action('quick31_'+name,{'venue':self.venue,**args},self.actor)

    def make_profile(self,equipment='Холодильник №2'):
        result=self.act('profile_save',code='fridge',title=equipment,
                        equipment=equipment,zone='Холодный цех',responsible='Анна Иванова',fixed={})
        return result['id']

    def records(self):
        return self.service.store.list_records(self.venue,'fridge',include_voided=False)

    def test_first_setup_then_single_actual_value(self):
        p=self.make_profile()
        cols=self.act('profiles',code='fridge')['columns']
        self.assertEqual({c['key']:c['kind'] for c in cols},
                         {'c1':'auto_stamp','c2':'zone','c3':'equipment','c4':'reading',
                          'c5':'empty_signature','c6':'comment'})
        first=self.act('record',profile_id=p,readings={'c4':'+3,8'},confirmed=True,
                       request_key='first-'+str(p))
        self.assertTrue(first['saved'])
        second=self.act('record',profile_id=p,readings={'c4':'+5,2'},confirmed=True,
                        request_key='second-'+str(p))
        self.assertTrue(second['saved'])
        self.assertNotEqual(first['record_id'],second['record_id'])
        with self.service.store.connect() as db:
            entries=list(db.execute('''
                SELECT r.data,m.observation_date,m.observation_time,m.equipment,m.zone,m.responsible
                FROM journal_records r JOIN easy19_web_record_meta m ON m.record_id=r.id
                WHERE r.venue_id=? AND r.template_code='fridge' ORDER BY r.id
            ''',(self.venue,)))
        self.assertEqual(len(entries),2)
        self.assertEqual([json.loads(r['data'])['c4'] for r in entries],['+3,8','+5,2'])
        self.assertEqual(entries[0]['equipment'],'Холодильник №2')
        self.assertEqual(entries[0]['zone'],'Холодный цех')
        self.assertEqual(entries[0]['responsible'],'Анна Иванова')
        self.assertEqual(json.loads(entries[0]['data'])['c5'],'')
        self.assertEqual(json.loads(entries[0]['data'])['c6'],'')
        self.assertEqual(entries[0]['observation_date'],date.today().isoformat())
        self.assertRegex(entries[1]['observation_time'],r'^\d{2}:\d{2}$')

    def test_no_result_reuse_no_fabricated_confirmation(self):
        p=self.make_profile()
        for answers,confirmed in [({},True),({'c4':''},True),({'c4':'4.1'},False)]:
            with self.assertRaises(ValueError):
                self.act('record',profile_id=p,readings=answers,confirmed=confirmed)
        self.assertEqual(len(self.records()),0)
        self.act('record',profile_id=p,readings={'c4':'1.7'},confirmed=True)
        with self.assertRaises(ValueError):
            self.act('record',profile_id=p,readings={},confirmed=True)
        self.assertEqual(len(self.records()),1)

    def test_retry_idempotence_and_saved_profile_updates(self):
        p=self.make_profile()
        args=dict(profile_id=p,readings={'c4':'2.0'},confirmed=True,request_key='device-check-1')
        r1=self.act('record',**args)
        r2=self.act('record',**args)
        self.assertEqual(r1['record_id'],r2['record_id'])
        self.assertTrue(r2['duplicate'])
        self.assertEqual(len(self.records()),1)
        update=self.act('profile_save',id=p,code='fridge',title='Холодильник №2',
                        equipment='Холодильник №3',zone='Горячий цех',
                        responsible='Анна Иванова',fixed={})
        self.assertEqual(update['id'],p)
        self.act('record',profile_id=p,readings={'c4':'1.5'},confirmed=True)
        self.assertEqual(len(self.records()),2)
        self.assertEqual(self.records()[0]['data']['c3'],'Холодильник №2')
        self.assertEqual(self.records()[1]['data']['c3'],'Холодильник №3')

    def test_presets_are_venue_scoped_and_fixed_fields_sanitized(self):
        p=self.make_profile()
        other=self.service.action('create_venue',{'name':'Другое предприятие'},self.actor)['venue']
        self.venue=other
        with self.assertRaises(ValueError):
            self.act('record',profile_id=p,readings={'c4':'3'},confirmed=True)
        with self.assertRaises(ValueError):
            self.act('profile_save',code='fridge',title='Измерение',
                     equipment='Прибор',zone='Цех',responsible='Повар',
                     fixed={'c4':'-999'})
        self.assertEqual(self.act('profiles',code='fridge')['profiles'],[])

    def test_safe_label_classification(self):
        items=[
         ('Дата и время','auto_stamp'),
         ('Дата','auto_date'),
         ('Время проверки','auto_time'),
         ('Дата изготовления','reading'),
         ('Температура','reading'),
         ('Результат обработки','reading'),
         ('Подпись ответственного','empty_signature'),
         ('Дата и время поступления','reading'),
         ('Примечание','comment'),
         ('Ответственный сотрудник','responsible'),
         ('Помещение','fixed'),
         ('Камера','fixed'),
         ('Предел по процедуре','fixed'),
         ('Фактически выполнено','reading'),
        ]
        for i,(label,expected) in enumerate(items):
            with self.subTest(label=label):
                self.assertEqual(quick31._kind('other',{'key':'col'+str(i),'label':label}),expected)

if __name__=='__main__':
    unittest.main()
