import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('aligner', Path(__file__).with_name('align-menu-karaoke.py'))
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)


class AlignmentTests(unittest.TestCase):
    def setUp(self):
        self.cues = a.load_cues()
        self.words = [dict(word=w[0], start=w[1], end=w[2], probability=.95) for c in self.cues for w in c['words']]

    def test_exact_lyrics_and_bounds(self):
        mapped = a.map_words(self.cues, self.words)
        result, report = a.candidate(self.cues, mapped, self.words)
        self.assertEqual(len(mapped), 240)
        self.assertEqual(len(result), 35)
        self.assertEqual([w[0] for c in result for w in c['words']], [w['word'] for w in self.words])
        self.assertEqual(result[2]['start'], result[1]['end'])
        self.assertEqual(result[2]['end'], result[3]['start'])
        self.assertEqual(result[-1]['end'], a.DURATION)
        self.assertEqual(sum(r['independentlyMatched'] for r in report), 240)

    def test_per_word_updates_not_global_offset(self):
        self.words[8]['start'] += .03
        self.words[9]['start'] += .05
        result, report = a.candidate(self.cues, a.map_words(self.cues, self.words), [])
        self.assertEqual(result[3]['start'], 12.63)
        self.assertEqual(result[3]['words'][1][1], 12.86)
        self.assertEqual(result[2]['end'], 12.63)
        self.assertTrue(all(r['review'] for r in report))

    def test_split_hyphen_and_reject_mismatch(self):
        self.words[0:1] = [dict(word='yippee',start=1.81,end=3),dict(word='-yay,',start=3,end=4.29)]
        self.assertEqual(a.map_words(self.cues, self.words)[0][:3], ('yippee-yay,',1.81,4.29))
        self.words[2]['word'] = 'incorrect'
        with self.assertRaises(ValueError):
            a.map_words(self.cues, self.words)

    def test_reject_overlap_and_missing_words(self):
        self.words[1]['start'] = 2
        with self.assertRaises(ValueError):
            a.map_words(self.cues, self.words)
        self.words[1]['start'] = 4.29
        with self.assertRaises(ValueError):
            a.map_words(self.cues, self.words[:-1])

    def test_reject_collapsed_instrumental(self):
        mapped = a.map_words(self.cues, self.words)
        token,start,end,prob = mapped[8]
        mapped[8] = (token, 8.54, end, prob)
        with self.assertRaises(ValueError):
            a.candidate(self.cues, mapped, self.words)


if __name__ == '__main__':
    unittest.main()
