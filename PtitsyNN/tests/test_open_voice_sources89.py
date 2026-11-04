import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from commons_voices89 import parse_info
from tsa_voices89 import parse_detail

class OpenBirdVoiceSources89(unittest.TestCase):
    def test_commons_exact_taxon_author_and_CC_license(self):
        ii={"url":"https://upload.wikimedia.org/wikipedia/commons/1/12/Anser_audio.mp3",
            "mime":"audio/mpeg","mediatype":"AUDIO","size":150000,
            "extmetadata":{"LicenseUrl":{"value":"https://creativecommons.org/licenses/by-sa/4.0/"},
                           "Artist":{"value":"<a href='https://example.com'>Recordist</a>"},
                           "ImageDescription":{"value":"Greylag goose bird calls"}}}
        title="File:Anser anser - Greylag Goose XC436358.mp3"
        rec=parse_info("Anser anser",title,ii)
        self.assertIsNotNone(rec)
        self.assertEqual(rec["sourcePlatform"],"Wikimedia Commons")
        self.assertEqual(rec["author"],"Recordist")
        self.assertIsNone(parse_info("Anser erythropus",title,ii))
        self.assertIsNone(parse_info("Anser anser",title,{**ii,"extmetadata":{**ii["extmetadata"],"LicenseUrl":{"value":"https://creativecommons.org/licenses/by-nc/4.0/"}}}))
        self.assertIsNone(parse_info("Anser anser",title,{**ii,"mime":"video/webm"}))

    def test_only_explicit_pallas_gull_field_video_audio_is_eligible(self):
        ii={"url":"https://upload.wikimedia.org/wikipedia/commons/1/12/gull.webm",
            "mime":"video/webm","mediatype":"VIDEO","size":15510000,
            "extmetadata":{"LicenseUrl":{"value":"https://creativecommons.org/licenses/by-sa/4.0/"},
                           "Artist":{"value":"Dmitry Mikhirev"},
                           "ImageDescription":{"value":"Pallas's Gull colony. Calls of adults and nestlings."}}}
        row=parse_info("Ichthyaetus ichthyaetus","File:Larus ichthyaetus 720p.webm",ii)
        self.assertIsNotNone(row)
        self.assertTrue(row["videoAudio"])
        self.assertIsNone(parse_info("Larus hyperboreus","File:Larus ichthyaetus 720p.webm",ii))
        self.assertIsNone(parse_info("Ichthyaetus ichthyaetus","File:Larus ichthyaetus 720p.webm",{**ii,"extmetadata":{**ii["extmetadata"],"ImageDescription":{"value":"No audio description"}}}))

    def test_tierstimmenarchiv_strict_species_sound_and_author(self):
        identifier="TSA:Lanius_minor_Kr_54_07_1"
        body="""<div class="audio-player"><audio id="audioplayer"
            src="/download.mp3?unique_identifier=TSA:Lanius_minor_Kr_54_07_1"></audio></div>
            <div class="license"><a href="https://creativecommons.org/licenses/by-sa/3.0/de/legalcode">CC BY-SA</a></div>
            <table><tr><td>Species</td><td>Lanius minor</td></tr>
            <tr><td>Author</td><td>Krey, Winfried</td><td>Collection</td><td>TSA</td></tr></table>"""
        row=parse_detail("Lanius minor",identifier,body)
        self.assertIsNotNone(row)
        self.assertEqual(row["author"],"Krey, Winfried")
        self.assertEqual(row["license"],"https://creativecommons.org/licenses/by-sa/3.0/")
        self.assertEqual(row["recordingId"],identifier)
        self.assertIsNone(parse_detail("Aquila heliaca",identifier,body))
        self.assertIsNone(parse_detail("Lanius minor",identifier,body.replace("/by-sa/","/by-nc-sa/").replace("CC BY-SA","CC BY-NC-SA")))
        self.assertIsNone(parse_detail("Lanius minor",identifier,body.replace("Krey, Winfried","Unknown")))

    def test_archive_historical_taxonomic_alias_is_explicit(self):
        ident="TSA:Accipiter_brevipes_Lue_60_1_1"
        body="""<audio src="/download.mp3?unique_identifier=TSA:Accipiter_brevipes_Lue_60_1_1"></audio>
            <div class="license"><a href="https://creativecommons.org/licenses/by-sa/3.0/de/legalcode">CC BY-SA</a></div>
            Species Accipiter brevipes Author Lütgens, Hans Collection TSA"""
        row=parse_detail("Tachyspiza brevipes",ident,body)
        self.assertIsNotNone(row)
        self.assertEqual(row["sourceTaxon"],"Accipiter brevipes")

    def test_archive_historical_names_do_not_lose_rare_calls(self):
        synonyms = {
            "Bubo scandiacus": "Nyctea scandiaca",
            "Mergellus albellus": "Mergus albellus",
            "Poecile cinctus": "Parus cinctus",
            "Ichthyaetus ichthyaetus": "Larus ichthyaetus",
        }
        for desired, archived in synonyms.items():
            with self.subTest(desired=desired):
                identifier = "TSA:" + archived.replace(" ", "_") + "_Recorder_1"
                body = (
                    '<audio src="/download.mp3?unique_identifier=' + identifier + '"></audio>'
                    '<div class="license"><a href="https://creativecommons.org/licenses/by/4.0/legalcode">CC BY</a></div>'
                    'Species ' + archived + ' Author Example Recordist Collection TSA'
                )
                result = parse_detail(desired, identifier, body)
                self.assertIsNotNone(result)
                self.assertEqual(result["sourceTaxon"], archived)
                self.assertEqual(result["license"], "https://creativecommons.org/licenses/by/4.0/")
                self.assertIsNone(parse_detail("Aquila heliaca", identifier, body))

    def test_known_mixed_background_recording_is_excluded(self):
        identifier="TSA:Aythya_nyroca_Lue_65_2_1"
        body="""<div class="audio-player"><audio src="/download.mp3?unique_identifier=TSA:Aythya_nyroca_Lue_65_2_1"></audio></div>
            <div class="license"><a href="https://creativecommons.org/licenses/by-sa/3.0/de/legalcode">CC BY-SA</a></div>
            Species Aythya nyroca Author Lütgens, Hans Collection TSA"""
        self.assertIsNone(parse_detail("Aythya nyroca",identifier,body))

if __name__=="__main__": unittest.main()
