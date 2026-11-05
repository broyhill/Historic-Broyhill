# ecosystem_38_personalization_engine.py
# AI Content Personalization That Looks 100% Human
# Learns each candidate's unique voice, style, and patterns

import asyncio
import psycopg2
from anthropic import Anthropic
from datetime import datetime
import json
import re
from typing import Dict, List
import random

class CandidatePersonalizationEngine:
    """
    Learn and replicate each candidate's unique writing style
    
    Makes AI-generated content indistinguishable from candidate's own posts
    """
    
    def __init__(self, db_config, claude_api_key):
        self.db = psycopg2.connect(**db_config)
        self.claude = Anthropic(api_key=claude_api_key)
    
    def analyze_candidate_voice(self, candidate_id: str) -> dict:
        """
        Deep analysis of candidate's existing social media posts
        
        Returns comprehensive style profile
        """
        
        # Get last 100 posts from candidate
        cur = self.db.cursor()
        cur.execute("""
            SELECT caption, platform, posted_at, engagement_score
            FROM social_posts
            WHERE candidate_id = %s
            AND status = 'published'
            ORDER BY posted_at DESC
            LIMIT 100
        """, (candidate_id,))
        
        posts = cur.fetchall()
        
        if not posts:
            return self.create_default_profile(candidate_id)
        
        # Extract patterns
        all_text = ' '.join([post[0] for post in posts])
        
        style_profile = {
            'candidate_id': candidate_id,
            'analyzed_at': datetime.now().isoformat(),
            'sample_size': len(posts),
            
            # WRITING PATTERNS
            'sentence_structure': self.analyze_sentence_structure(posts),
            'paragraph_length': self.analyze_paragraph_length(posts),
            'punctuation_style': self.analyze_punctuation(all_text),
            'capitalization_patterns': self.analyze_caps(all_text),
            
            # VOCABULARY
            'common_phrases': self.extract_common_phrases(posts),
            'signature_words': self.extract_signature_words(all_text),
            'opening_lines': self.extract_opening_patterns(posts),
            'closing_lines': self.extract_closing_patterns(posts),
            
            # EMOTIONAL TONE
            'primary_emotions': self.detect_primary_emotions(posts),
            'intensity_level': self.measure_intensity(all_text),
            'formality_level': self.measure_formality(all_text),
            
            # FORMATTING
            'emoji_usage': self.analyze_emoji_usage(all_text),
            'hashtag_patterns': self.analyze_hashtag_usage(posts),
            'link_placement': self.analyze_link_placement(posts),
            'emphasis_style': self.analyze_emphasis(all_text),  # ALL CAPS, **bold**, etc.
            
            # CONTENT THEMES
            'favorite_topics': self.extract_favorite_topics(posts),
            'typical_cta': self.extract_cta_patterns(posts),
            'personal_references': self.extract_personal_refs(all_text),
            
            # TIMING
            'preferred_post_times': self.analyze_post_times(posts),
            'post_frequency': self.calculate_frequency(posts)
        }
        
        # Store profile
        self.save_voice_profile(candidate_id, style_profile)
        
        return style_profile
    
    def analyze_sentence_structure(self, posts: List) -> dict:
        """Analyze how candidate structures sentences"""
        
        all_sentences = []
        for post in posts:
            # Split into sentences
            sentences = re.split(r'[.!?]+', post[0])
            all_sentences.extend([s.strip() for s in sentences if s.strip()])
        
        return {
            'avg_length': sum(len(s.split()) for s in all_sentences) / len(all_sentences),
            'uses_fragments': sum(1 for s in all_sentences if len(s.split()) <= 3) > len(all_sentences) * 0.1,
            'uses_questions': sum(1 for post in posts if '?' in post[0]) / len(posts),
            'uses_exclamations': sum(1 for post in posts if '!' in post[0]) / len(posts)
        }
    
    def analyze_emoji_usage(self, text: str) -> dict:
        """Learn emoji patterns"""
        
        # Extract all emojis
        emoji_pattern = re.compile("["
            u"\U0001F600-\U0001F64F"  # emoticons
            u"\U0001F300-\U0001F5FF"  # symbols & pictographs
            u"\U0001F680-\U0001F6FF"  # transport & map symbols
            u"\U0001F1E0-\U0001F1FF"  # flags
            "]+", flags=re.UNICODE)
        
        emojis = emoji_pattern.findall(text)
        
        if not emojis:
            return {'uses_emojis': False}
        
        # Count frequency
        from collections import Counter
        emoji_freq = Counter(emojis)
        
        return {
            'uses_emojis': True,
            'frequency': len(emojis) / len(text.split('\n\n')),  # per post
            'favorite_emojis': [e for e, _ in emoji_freq.most_common(5)],
            'placement': self.detect_emoji_placement(text)
        }
    
    def extract_common_phrases(self, posts: List) -> List[str]:
        """Extract signature phrases candidate uses repeatedly"""
        
        all_text = ' '.join([post[0] for post in posts]).lower()
        
        # Look for repeated 2-5 word phrases
        phrases = []
        words = all_text.split()
        
        for length in [2, 3, 4, 5]:
            for i in range(len(words) - length):
                phrase = ' '.join(words[i:i+length])
                if all_text.count(phrase) >= 3:  # Appears 3+ times
                    if phrase not in phrases:
                        phrases.append(phrase)
        
        return phrases[:20]  # Top 20
    
    def extract_opening_patterns(self, posts: List) -> List[str]:
        """How does candidate typically start posts?"""
        
        openings = []
        for post in posts:
            # Get first sentence
            first_sentence = post[0].split('.')[0].strip()
            if len(first_sentence.split()) <= 10:  # Short opener
                openings.append(first_sentence)
        
        # Find most common patterns
        from collections import Counter
        return [o for o, _ in Counter(openings).most_common(10)]
    
    def add_human_imperfections(self, post: str, style_profile: dict) -> str:
        """
        Make AI-generated content feel MORE human
        (Ironically, perfection looks artificial)
        """
        
        variations = {
            'sentence_starts': self.vary_sentence_starts(post, style_profile),
            'contractions': self.randomly_add_contractions(post),
            'informal_language': self.add_conversational_elements(post, style_profile),
            'personal_touches': self.add_personal_references(post, style_profile),
            'local_references': self.add_local_details(post, style_profile)
        }
        
        return self.apply_variations(post, variations, style_profile)
    
    def vary_sentence_starts(self, post: str, style_profile: dict) -> str:
        """Vary how sentences begin (avoid AI's repetitive patterns)"""
        
        sentences = re.split(r'([.!?]+)', post)
        
        # AI loves starting with "I", "We", "The" - mix it up
        varied = []
        for i, sentence in enumerate(sentences):
            if sentence.strip() and i % 2 == 0:  # Actual sentence (not punctuation)
                # Occasionally use candidate's signature openers
                if random.random() < 0.3 and style_profile.get('opening_lines'):
                    opener = random.choice(style_profile['opening_lines'])
                    sentence = opener + '. ' + sentence
                
                varied.append(sentence)
            else:
                varied.append(sentence)
        
        return ''.join(varied)
    
    def randomly_add_contractions(self, post: str) -> str:
        """AI often uses formal "we are" - humans use "we're" """
        
        contractions = {
            'we are': "we're",
            'I am': "I'm",
            'you are': "you're",
            'it is': "it's",
            'that is': "that's",
            'cannot': "can't",
            'will not': "won't",
            'do not': "don't"
        }
        
        for formal, informal in contractions.items():
            # 70% chance to use contraction
            if random.random() < 0.7:
                post = post.replace(formal, informal)
        
        return post
    
    def add_conversational_elements(self, post: str, style_profile: dict) -> str:
        """Add natural conversational markers"""
        
        # Candidate's typical conversational phrases
        casual_intros = [
            "Look,", "Listen,", "Folks,", "Here's the thing:",
            "Let me be clear:", "Bottom line:", "Real talk:"
        ]
        
        # Check if candidate uses these
        if style_profile.get('formality_level', 5) < 5:  # Informal
            # 40% chance to add conversational opener
            if random.random() < 0.4:
                intro = random.choice(casual_intros)
                post = intro + ' ' + post
        
        return post
    
    def add_personal_references(self, post: str, style_profile: dict) -> str:
        """Add personal touches candidate typically uses"""
        
        # Get candidate's typical personal references
        personal_refs = style_profile.get('personal_references', [])
        
        if personal_refs and random.random() < 0.3:
            ref = random.choice(personal_refs)
            # Insert naturally
            sentences = post.split('.')
            if len(sentences) > 1:
                sentences[1] = f" {ref}." + sentences[1]
                post = '.'.join(sentences)
        
        return post
    
    def add_local_details(self, post: str, style_profile: dict) -> str:
        """Add local references candidate uses"""
        
        # Get candidate's location
        cur = self.db.cursor()
        cur.execute("""
            SELECT county, district, city
            FROM candidates
            WHERE candidate_id = %s
        """, (style_profile['candidate_id'],))
        
        location = cur.fetchone()
        
        if location and random.random() < 0.25:
            # Add "here in [location]" occasionally
            local_phrase = f"here in {location[0]}"
            post = post.replace("here", local_phrase, 1)
        
        return post
    
    def apply_variations(self, post: str, variations: dict, style_profile: dict) -> str:
        """Apply all variations to make content feel human"""
        
        # Start with sentence variation
        result = variations['sentence_starts']
        
        # Add contractions
        result = variations['contractions']
        
        # Add conversational elements
        result = variations['informal_language']
        
        # Add personal touches
        result = variations['personal_touches']
        
        # Add local references
        result = variations['local_references']
        
        # Match candidate's emoji style
        if style_profile.get('emoji_usage', {}).get('uses_emojis'):
            result = self.add_emojis_matching_style(result, style_profile)
        
        # Match candidate's emphasis style
        if style_profile.get('emphasis_style', {}).get('uses_caps'):
            result = self.add_caps_emphasis(result, style_profile)
        
        return result
    
    def add_emojis_matching_style(self, post: str, style_profile: dict) -> str:
        """Add emojis matching candidate's typical usage"""
        
        emoji_prefs = style_profile['emoji_usage']
        favorite_emojis = emoji_prefs.get('favorite_emojis', ['🇺🇸', '🔥', '💪'])
        placement = emoji_prefs.get('placement', 'end')
        
        # Add 1-2 emojis
        num_emojis = random.randint(1, 2)
        emojis_to_add = random.sample(favorite_emojis, min(num_emojis, len(favorite_emojis)))
        
        if placement == 'end':
            post += ' ' + ' '.join(emojis_to_add)
        elif placement == 'inline':
            sentences = post.split('.')
            if len(sentences) > 1:
                sentences[0] += f' {emojis_to_add[0]}'
                post = '.'.join(sentences)
        
        return post
    
    def add_caps_emphasis(self, post: str, style_profile: dict) -> str:
        """Add ALL CAPS emphasis like candidate does"""
        
        # Find key phrases to emphasize
        emphasis_words = ['must', 'need', 'critical', 'urgent', 'now', 'today']
        
        for word in emphasis_words:
            if word in post.lower() and random.random() < 0.5:
                post = re.sub(rf'\b{word}\b', word.upper(), post, flags=re.IGNORECASE)
        
        return post
    
    async def generate_personalized_post(self, candidate_id: str, topic: dict, 
                                        platform: str = 'facebook') -> str:
        """
        Generate post matching candidate's exact voice
        
        topic = {
            'subject': 'Wake County schools CRT spending',
            'key_points': ['$2.3M spent', 'teachers underpaid', 'parents upset'],
            'desired_action': 'donate',
            'urgency': 'high'
        }
        """
        
        # Get candidate's voice profile
        style_profile = self.get_voice_profile(candidate_id)
        
        if not style_profile:
            # First time - analyze candidate's existing posts
            style_profile = self.analyze_candidate_voice(candidate_id)
        
        # Get candidate info
        candidate = self.get_candidate(candidate_id)
        
        # Generate post using AI with style instructions
        prompt = f"""
        You are {candidate['name']}, running for {candidate['office']}.
        
        Generate a social media post for {platform} about this topic:
        
        Subject: {topic['subject']}
        Key Points: {', '.join(topic['key_points'])}
        Call to Action: {topic['desired_action']}
        Urgency: {topic['urgency']}
        
        CRITICAL: Match this exact writing style:
        
        Sentence Structure:
        - Average length: {style_profile['sentence_structure']['avg_length']} words
        - Uses fragments: {style_profile['sentence_structure']['uses_fragments']}
        - Uses questions: {style_profile['sentence_structure']['uses_questions'] * 100}% of posts
        - Uses exclamations: {style_profile['sentence_structure']['uses_exclamations'] * 100}% of posts
        
        Common Phrases (use 2-3 of these):
        {', '.join(style_profile['common_phrases'][:10])}
        
        Typical Openers (use one of these):
        {', '.join(style_profile['opening_lines'][:5])}
        
        Typical Closes (use one of these):
        {', '.join(style_profile['closing_lines'][:5])}
        
        Emoji Usage:
        - Frequency: {style_profile['emoji_usage']['frequency']} per post
        - Favorites: {', '.join(style_profile['emoji_usage']['favorite_emojis'])}
        
        Hashtags:
        - Average: {style_profile['hashtag_patterns']['avg_count']} per post
        - Placement: {style_profile['hashtag_patterns']['placement']}
        
        Call-to-Action Style:
        {style_profile['typical_cta']}
        
        CRITICAL: Write this post EXACTLY as {candidate['name']} would write it.
        Use his vocabulary, his tone, his format, his style.
        This must be indistinguishable from his actual writing.
        
        Write the post now:
        """
        
        response = await self.claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        post = response.content[0].text.strip()
        
        # Add human imperfections
        post = self.add_human_imperfections(post, style_profile)
        
        return post
    
    # ================================================================
    # HELPER METHODS
    # ================================================================
    
    def get_voice_profile(self, candidate_id: str) -> Optional[dict]:
        """Load saved voice profile"""
        cur = self.db.cursor()
        cur.execute("""
            SELECT profile_data
            FROM candidate_voice_profiles
            WHERE candidate_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (candidate_id,))
        
        result = cur.fetchone()
        return json.loads(result[0]) if result else None
    
    def save_voice_profile(self, candidate_id: str, profile: dict):
        """Save voice profile to database"""
        cur = self.db.cursor()
        cur.execute("""
            INSERT INTO candidate_voice_profiles
            (candidate_id, profile_data, created_at)
            VALUES (%s, %s, NOW())
        """, (candidate_id, json.dumps(profile)))
        self.db.commit()
    
    def create_default_profile(self, candidate_id: str) -> dict:
        """Create default profile for new candidate"""
        candidate = self.get_candidate(candidate_id)
        
        return {
            'candidate_id': candidate_id,
            'sentence_structure': {
                'avg_length': 15,
                'uses_fragments': False,
                'uses_questions': 0.3,
                'uses_exclamations': 0.5
            },
            'emoji_usage': {
                'uses_emojis': True,
                'frequency': 2,
                'favorite_emojis': ['🇺🇸', '🔥', '💪'],
                'placement': 'end'
            },
            'hashtag_patterns': {
                'avg_count': 3,
                'placement': 'end'
            },
            'formality_level': 5,
            'common_phrases': [],
            'opening_lines': [],
            'closing_lines': [],
            'typical_cta': 'Donate $25'
        }
    
    def get_candidate(self, candidate_id: str) -> dict:
        """Get candidate info"""
        cur = self.db.cursor()
        cur.execute("""
            SELECT candidate_id, name, office, party
            FROM candidates
            WHERE candidate_id = %s
        """, (candidate_id,))
        row = cur.fetchone()
        return {
            'candidate_id': row[0],
            'name': row[1],
            'office': row[2],
            'party': row[3]
        } if row else None


# ================================================================
# EXAMPLE USAGE
# ================================================================

async def example_usage():
    """
    Example: Generate personalized post
    """
    
    DB_CONFIG = {
        'host': 'db.YOUR_PROJECT.supabase.co',
        'database': 'postgres',
        'user': 'postgres',
        'password': 'YOUR_PASSWORD',
        'port': 5432
    }
    
    CLAUDE_API_KEY = "YOUR_CLAUDE_API_KEY"
    
    # Initialize
    engine = CandidatePersonalizationEngine(DB_CONFIG, CLAUDE_API_KEY)
    
    # Analyze candidate's writing style
    print("Analyzing candidate's writing style...")
    style_profile = engine.analyze_candidate_voice('candidate_001')
    
    print(f"✅ Style analysis complete")
    print(f"   Avg sentence length: {style_profile['sentence_structure']['avg_length']} words")
    print(f"   Uses emojis: {style_profile['emoji_usage']['uses_emojis']}")
    print(f"   Favorite emojis: {', '.join(style_profile['emoji_usage']['favorite_emojis'])}")
    
    # Generate personalized post
    print("\nGenerating personalized post...")
    post = await engine.generate_personalized_post(
        candidate_id='candidate_001',
        topic={
            'subject': 'Wake County schools CRT spending',
            'key_points': ['$2.3M spent', 'teachers underpaid', 'parents upset'],
            'desired_action': 'donate',
            'urgency': 'high'
        },
        platform='facebook'
    )
    
    print(f"✅ Post generated:\n\n{post}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(example_usage())
