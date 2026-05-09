"""
Management command to seed demo data for final presentation.

Usage:
    python manage.py seed_data            # add missing data, keep existing
    python manage.py seed_data --clear    # wipe seed data first, then re-seed
    python manage.py seed_data --no-images  # skip MediaItem creation (offline/prod)
"""

import random
import urllib.request
from urllib.error import URLError

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand

from .personal_stories_data import PERSONAL_STORIES, STORY_COMMENTS
from django.db import transaction

from apps.gamification.constants import (
    STORY_COMMENTED,
    STORY_LIKED,
    STORY_PUBLISHED,
    STORY_SAVED,
    USER_COMMENTED,
    USER_LIKED,
)
from apps.gamification.services import award_points, award_registration_badge
from apps.interactions.models import Comment, Like, SavedStory
from apps.media.models import MediaItem, MediaType
from apps.stories.models import Story
from apps.tags.models import StoryTag, Tag
from apps.users.models import Follow, User, UserProfile

# ── Seed users ─────────────────────────────────────────────────────────────────

USERS = [
    {
        'email': 'admin@historystorymap.com',
        'username': 'admin',
        'password': 'Admin1234!',
        'role': 'admin',
        'first_name': 'Admin',
        'last_name': 'User',
        'bio': 'Platform administrator.',
        'location': 'Istanbul, Turkey',
        'is_staff': True,
        'is_superuser': True,
    },
    {
        'email': 'ahmet.yilmaz@example.com',
        'username': 'ahmet_yilmaz',
        'password': 'Test1234!',
        'first_name': 'Ahmet',
        'last_name': 'Yılmaz',
        'bio': 'Tarih tutkunu, İstanbul gezgini.',
        'location': 'Istanbul, Turkey',
    },
    {
        'email': 'zeynep.kaya@example.com',
        'username': 'zeynep_kaya',
        'password': 'Test1234!',
        'first_name': 'Zeynep',
        'last_name': 'Kaya',
        'bio': 'Arkeoloji meraklısı.',
        'location': 'Ankara, Turkey',
    },
    {
        'email': 'mehmet.demir@example.com',
        'username': 'mehmet_demir',
        'password': 'Test1234!',
        'first_name': 'Mehmet',
        'last_name': 'Demir',
        'bio': 'Fotoğrafçı ve tarihçi.',
        'location': 'Izmir, Turkey',
    },
    {
        'email': 'fatma.arslan@example.com',
        'username': 'fatma_arslan',
        'password': 'Test1234!',
        'first_name': 'Fatma',
        'last_name': 'Arslan',
        'bio': 'Osmanlı tarihi uzmanı.',
        'location': 'Bursa, Turkey',
    },
    {
        'email': 'can.ozturk@example.com',
        'username': 'can_ozturk',
        'password': 'Test1234!',
        'first_name': 'Can',
        'last_name': 'Öztürk',
        'bio': 'Şehir tarihi araştırmacısı.',
        'location': 'Istanbul, Turkey',
    },
    {
        'email': 'emily.johnson@example.com',
        'username': 'emily_johnson',
        'password': 'Test1234!',
        'first_name': 'Emily',
        'last_name': 'Johnson',
        'bio': 'Byzantine history enthusiast from Chicago.',
        'location': 'Chicago, USA',
    },
    {
        'email': 'james.miller@example.com',
        'username': 'james_miller',
        'password': 'Test1234!',
        'first_name': 'James',
        'last_name': 'Miller',
        'bio': 'Travel writer and amateur historian.',
        'location': 'London, UK',
    },
    {
        'email': 'elif.celik@example.com',
        'username': 'elif_celik',
        'password': 'Test1234!',
        'first_name': 'Elif',
        'last_name': 'Çelik',
        'bio': 'Müzeci ve kültürel miras koruyucusu.',
        'location': 'Konya, Turkey',
    },
    {
        'email': 'ali.sahin@example.com',
        'username': 'ali_sahin',
        'password': 'Test1234!',
        'first_name': 'Ali',
        'last_name': 'Şahin',
        'bio': 'Karadeniz tarihi ve kültürü.',
        'location': 'Trabzon, Turkey',
    },
    {
        'email': 'sara.white@example.com',
        'username': 'sara_white',
        'password': 'Test1234!',
        'first_name': 'Sara',
        'last_name': 'White',
        'bio': 'Archaeologist specializing in Anatolian civilizations.',
        'location': 'Boston, USA',
    },
]

# ── Extra tags beyond predefined ───────────────────────────────────────────────

EXTRA_TAGS = ['osmanlı', 'cumhuriyet', 'bizans', 'selçuklu', 'anadolu-tarihi', 'nostalgia', 'family', 'neighborhood', 'youth']

# ── Stories ────────────────────────────────────────────────────────────────────

STORIES = [
    # ── Istanbul (12 stories) ──────────────────────────────────────────────
    {
        'title': 'Topkapı Sarayı: Osmanlı İmparatorluğu\'nun Kalbi',
        'narrative': (
            'Topkapı Sarayı, 1478 yılında II. Mehmed tarafından inşa ettirilmiş ve yaklaşık dört yüzyıl boyunca '
            'Osmanlı padişahlarının resmi ikametgâhı olarak kullanılmıştır. Sarayın iç avlularında yüzlerce cariye, '
            'ustabaşı ve devlet görevlisi yaşardı. Harem bölümünde geçen entrikalar, Osmanlı siyasetini derinden '
            'etkilemiştir. Bugün müzeye dönüştürülen saray, Osmanlı dönemine ait paha biçilmez eserleri barındırmaktadır.'
        ),
        'location_lat': '41.011500',
        'location_lng': '28.983600',
        'location_name': 'Topkapı Sarayı',
        'region': 'Istanbul',
        'time_type': Story.TIME_EXACT,
        'year': 1478,
        'tags': ['osmanlı', 'mimari', 'history'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Topkap%C4%B1_-_01.jpg/960px-Topkap%C4%B1_-_01.jpg',
    },
    {
        'title': 'Hagia Sophia: From Cathedral to Mosque',
        'narrative': (
            'Hagia Sophia has stood at the crossroads of history for nearly 1,500 years. Built by Emperor Justinian I '
            'in 537 AD, it was the largest cathedral in the world for nearly a thousand years. After the Ottoman conquest '
            'of Constantinople in 1453, Sultan Mehmed II converted it into a mosque. In 1934, Atatürk transformed it into '
            'a museum, and in 2020 it was reconverted into a mosque. Each layer of its history is visible in its walls.'
        ),
        'location_lat': '41.008600',
        'location_lng': '28.980200',
        'location_name': 'Hagia Sophia',
        'region': 'Istanbul',
        'time_type': Story.TIME_RANGE,
        'year_start': 537,
        'year_end': 1934,
        'tags': ['bizans', 'osmanlı', 'mimari'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Hagia_Sophia_%28228968325%29.jpeg/960px-Hagia_Sophia_%28228968325%29.jpeg',
    },
    {
        'title': 'Galata Kulesi ve Hezarfen Ahmed Çelebi\'nin Efsanevi Uçuşu',
        'narrative': (
            'Hezarfen Ahmed Çelebi, yaklaşık 1630\'lu yıllarda Galata Kulesi\'nden yapay kanatlarla atlayarak Boğaz\'ı '
            'geçtiği ve Üsküdar\'a indiği rivayet edilen efsanevi Osmanlı mucididir. Evliya Çelebi\'nin Seyahatnâme\'sinde '
            'aktarılan bu hikâye, dönemin insanlarını derinden etkilemiştir. IV. Murad\'ın bile bu cesareti takdirle '
            'karşıladığı söylenir. Galata Kulesi bugün İstanbul\'un en simgesel yapılarından biri olmaya devam etmektedir.'
        ),
        'location_lat': '41.025700',
        'location_lng': '28.974300',
        'location_name': 'Galata Kulesi',
        'region': 'Istanbul',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 1630,
        'tags': ['osmanlı', 'culture', 'history'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Galata_tower_01_23.jpg/960px-Galata_tower_01_23.jpg',
    },
    {
        'title': 'The Grand Bazaar: Heart of Ottoman Commerce',
        'narrative': (
            'The Grand Bazaar in Istanbul is one of the oldest and largest covered markets in the world, with over 4,000 '
            'shops. Established around 1461 during the reign of Sultan Mehmed II, it became the center of Ottoman trade '
            'networks stretching from Venice to Persia. At its peak, the bazaar housed merchants from dozens of nations, '
            'trading spices, silk, jewels, and carpets. Today it still draws millions of visitors each year.'
        ),
        'location_lat': '41.010700',
        'location_lng': '28.968000',
        'location_name': 'Kapalıçarşı (Grand Bazaar)',
        'region': 'Istanbul',
        'time_type': Story.TIME_DECADE,
        'year': 1460,
        'tags': ['osmanlı', 'culture', 'daily-life'],
        'image_url': None,
    },
    {
        'title': 'Boğaziçi Köprüsü\'nün İnşaatı',
        'narrative': (
            '1973 yılında açılan Boğaziçi Köprüsü, Avrupa ile Asya\'yı birbirine bağlayan ilk sabit bağlantı noktası '
            'oldu. İnşaat sürecinde yaklaşık 3.500 işçi çalıştı ve köprünün toplam uzunluğu 1.560 metreye ulaştı. '
            'Köprünün açılışı Cumhuriyet\'in 50. yılına denk getirildi. Günümüzde ise yaklaşık 200.000 araç her gün '
            'bu köprüyü kullanmaktadır.'
        ),
        'location_lat': '41.045900',
        'location_lng': '29.033900',
        'location_name': 'Boğaziçi Köprüsü',
        'region': 'Istanbul',
        'time_type': Story.TIME_EXACT,
        'year': 1973,
        'tags': ['cumhuriyet', 'history'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Bosphorus_Bridge_%28235499411%29.jpeg/960px-Bosphorus_Bridge_%28235499411%29.jpeg',
    },
    {
        'title': 'The Blue Mosque: Sultan Ahmed\'s Legacy',
        'narrative': (
            'The Sultan Ahmed Mosque, known as the Blue Mosque for its stunning Iznik tiles, was commissioned by Sultan '
            'Ahmed I and completed in 1616. It is the only mosque in Istanbul with six minarets — a feature that caused '
            'controversy at the time, as six minarets were reserved for the mosque in Mecca. The mosque\'s architect, '
            'Sedefkâr Mehmed Ağa, a student of the great Mimar Sinan, designed it to rival Hagia Sophia across the square.'
        ),
        'location_lat': '41.005500',
        'location_lng': '28.976400',
        'location_name': 'Sultan Ahmed Camii (Blue Mosque)',
        'region': 'Istanbul',
        'time_type': Story.TIME_EXACT,
        'year': 1616,
        'tags': ['osmanlı', 'mimari', 'religion'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Istanbul_%2834223582516%29_%28cropped%29.jpg/960px-Istanbul_%2834223582516%29_%28cropped%29.jpg',
    },
    {
        'title': 'Kız Kulesi: Efsaneler ve Tarih',
        'narrative': (
            'Bizans döneminden beri İstanbul Boğazı\'nın Anadolu yakasında yükselen Kız Kulesi, pek çok efsaneye ev '
            'sahipliği yapmıştır. Rivayete göre bir kehanetten kaçınmak isteyen bir imparator, kızını yılanlara karşı '
            'korumak amacıyla onu bu kuleye hapsetmiştir. Osmanlı döneminde deniz feneri ve karantina merkezi olarak '
            'kullanılan kule, bugün İstanbul\'un en romantik sembollerinden biridir.'
        ),
        'location_lat': '41.021400',
        'location_lng': '29.004200',
        'location_name': 'Kız Kulesi',
        'region': 'Istanbul',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 1110,
        'tags': ['bizans', 'culture', 'history'],
        'image_url': None,
    },
    {
        'title': 'Dolmabahçe Palace: The Last Imperial Residence',
        'narrative': (
            'Dolmabahçe Palace was the administrative center of the Ottoman Empire from 1856 until the empire\'s collapse. '
            'Built on reclaimed land along the Bosphorus by Sultan Abdülmecid I, it blended European Baroque, Rococo, '
            'and Neoclassical architecture with traditional Ottoman design. The palace hosted 17 sultans. Atatürk spent '
            'his final days here and died at Dolmabahçe on November 10, 1938 — all clocks in the palace are still stopped '
            'at 9:05, the moment of his death.'
        ),
        'location_lat': '41.039400',
        'location_lng': '29.000300',
        'location_name': 'Dolmabahçe Sarayı',
        'region': 'Istanbul',
        'time_type': Story.TIME_RANGE,
        'year_start': 1856,
        'year_end': 1922,
        'tags': ['osmanlı', 'cumhuriyet', 'mimari'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Dolmabahce_Istanbul_Turkey.jpg/960px-Dolmabahce_Istanbul_Turkey.jpg',
    },
    {
        'title': 'İstiklal Caddesi\'nin Dönüşümü',
        'narrative': (
            '19. yüzyılın sonlarında "Grande Rue de Péra" olarak bilinen bu cadde, Levanten ve yabancı toplulukların '
            'yaşam merkezi hâline geldi. Fransız elçiliğinden İngiliz Saray\'ına uzanan cadde boyunca açılan pasajlar, '
            'kitabevleri ve kafeler, İstanbul\'un kozmopolit ruhunu yansıtıyordu. Nostaljik kırmızı tramvayın hâlâ '
            'işlediği cadde, bugün de şehrin kültürel nabzını tutmaktadır.'
        ),
        'location_lat': '41.033000',
        'location_lng': '28.977400',
        'location_name': 'İstiklal Caddesi, Beyoğlu',
        'region': 'Istanbul',
        'time_type': Story.TIME_DECADE,
        'year': 1870,
        'tags': ['culture', 'daily-life', 'history'],
        'image_url': None,
    },
    {
        'title': 'Byzantine Sea Walls of Constantinople',
        'narrative': (
            'The sea walls of Constantinople were constructed during the reign of Emperor Theodosius II in the 5th century '
            'and extended over centuries. Stretching along the Marmara Sea and the Golden Horn, these walls protected the '
            'city for nearly a thousand years. No army successfully breached them until the Ottoman siege of 1453. Today, '
            'remnants of these walls still stand in several neighborhoods, silent witnesses to a millennium of history.'
        ),
        'location_lat': '41.002000',
        'location_lng': '28.942000',
        'location_name': 'Yedikule Zindanları (Sea Walls)',
        'region': 'Istanbul',
        'time_type': Story.TIME_DECADE,
        'year': 440,
        'tags': ['bizans', 'mimari', 'war'],
        'image_url': None,
    },
    {
        'title': 'Mısır Çarşısı: Baharatların Buluşma Noktası',
        'narrative': (
            '1664 yılında Mısır\'dan gelen vergi gelirleriyle inşa edilen Mısır Çarşısı ya da Kapalı Baharat Pazarı, '
            'İstanbul\'un en eski ticaret merkezlerinden biridir. Yüzyıllar boyunca Hint Okyanusu\'ndan gelen baharatlar, '
            'Anadolu\'nun dört bir yanından gelen kuruyemişler ve şifalı otlar burada alınıp satılmıştır. Eminönü\'nün '
            'kalbinde yer alan çarşı, günümüzde de en renkli ve kokulu yerlerden biri olmayı sürdürmektedir.'
        ),
        'location_lat': '41.016700',
        'location_lng': '28.970500',
        'location_name': 'Mısır Çarşısı, Eminönü',
        'region': 'Istanbul',
        'time_type': Story.TIME_EXACT,
        'year': 1664,
        'tags': ['osmanlı', 'daily-life', 'food'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Spice_Bazaar_Istanbul_Feb_2020%2C_img_2.jpg/960px-Spice_Bazaar_Istanbul_Feb_2020%2C_img_2.jpg',
    },
    {
        'title': 'Rumeli Fortress: Preparing the Conquest',
        'narrative': (
            'Rumeli Hisarı was built by Sultan Mehmed II in just four months in 1452, directly across from the older '
            'Anatolian Fortress on the other side of the Bosphorus. Together they controlled all sea traffic through '
            'the strait, cutting off Constantinople\'s supply lines from the Black Sea. The speed of construction '
            'shocked the Byzantines and signaled the final countdown to the Ottoman conquest of Constantinople in 1453.'
        ),
        'location_lat': '41.084900',
        'location_lng': '29.054000',
        'location_name': 'Rumeli Hisarı',
        'region': 'Istanbul',
        'time_type': Story.TIME_EXACT,
        'year': 1452,
        'tags': ['osmanlı', 'war', 'mimari'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Istanbul%2C_Turkey_-_53686764072.jpg/960px-Istanbul%2C_Turkey_-_53686764072.jpg',
    },

    # ── Ankara (5 stories) ─────────────────────────────────────────────────
    {
        'title': 'TBMM\'nin Açılışı: Yeni Bir Milletin Doğuşu',
        'narrative': (
            '23 Nisan 1920\'de Ankara\'da toplanan Büyük Millet Meclisi, Türk milletinin bağımsızlık iradesinin simgesi '
            'oldu. Mustafa Kemal Atatürk\'ün önderliğinde kurulan bu meclis, hem Osmanlı yönetimine hem de işgal '
            'kuvvetlerine karşı mücadelenin merkezine dönüştü. Meclis binasının açılışında okunan dualar ve atılan '
            'toplar, yeni bir Türkiye\'nin müjdesini veriyordu.'
        ),
        'location_lat': '39.908100',
        'location_lng': '32.847900',
        'location_name': 'TBMM (1. Meclis Binası)',
        'region': 'Ankara',
        'time_type': Story.TIME_DATE,
        'date_value': '1920-04-23',
        'tags': ['cumhuriyet', 'history', 'anadolu-tarihi'],
        'image_url': None,
    },
    {
        'title': 'Anıtkabir: The Eternal Home of Atatürk',
        'narrative': (
            'Anıtkabir, the mausoleum of Mustafa Kemal Atatürk, was completed in 1953 on a hill overlooking Ankara. '
            'Every year on November 10, the entire nation observes a moment of silence at 9:05 AM in memory of Atatürk\'s '
            'death. The mausoleum complex includes a museum, ceremonial guards, and meticulously maintained grounds. '
            'It remains one of the most visited sites in Turkey, drawing millions who come to pay their respects.'
        ),
        'location_lat': '39.925400',
        'location_lng': '32.836200',
        'location_name': 'Anıtkabir',
        'region': 'Ankara',
        'time_type': Story.TIME_EXACT,
        'year': 1953,
        'tags': ['cumhuriyet', 'mimari', 'history'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Ataturk%27s_Mausoleum_%286225341313%29.jpg/960px-Ataturk%27s_Mausoleum_%286225341313%29.jpg',
    },
    {
        'title': 'Ankara Kalesi: Roma\'dan Bizans\'a Uzanan İzler',
        'narrative': (
            'Ankara\'nın tarihi kalesinin temelleri Roma dönemine, hatta bazı araştırmacılara göre daha öncesine '
            'uzanmaktadır. Bizans döneminde genişletilen kale, Osmanlı fethinin ardından daha da güçlendirilmiştir. '
            'Kale içindeki dar sokaklar ve taş evler, yüzyılların katmanlarını günümüze taşımaktadır. Höyük olarak da '
            'bilinen bu tepe, Ankara\'nın tarihî hafızasının simgesidir.'
        ),
        'location_lat': '39.940900',
        'location_lng': '32.864300',
        'location_name': 'Ankara Kalesi',
        'region': 'Ankara',
        'time_type': Story.TIME_DECADE,
        'year': 200,
        'tags': ['bizans', 'anadolu-tarihi', 'mimari'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Ankara_Castle.jpg/960px-Ankara_Castle.jpg',
    },
    {
        'title': 'Anatolian Civilizations Museum: A Journey Through Millennia',
        'narrative': (
            'The Museum of Anatolian Civilizations in Ankara houses one of the world\'s finest collections of Hittite '
            'artifacts. Located in a restored 15th-century Ottoman bedesten, the museum opened in 1921 and has been '
            'named European Museum of the Year. Walking through its galleries is like traveling from the Paleolithic '
            'era through the Hittite Empire, Phrygian kingdom, Urartian civilization, and into the classical period.'
        ),
        'location_lat': '39.940100',
        'location_lng': '32.861800',
        'location_name': 'Anadolu Medeniyetleri Müzesi',
        'region': 'Ankara',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 1921,
        'tags': ['anadolu-tarihi', 'history', 'culture'],
        'image_url': None,
    },
    {
        'title': 'Hacettepe ve Cumhuriyetin Bilim Hamlesi',
        'narrative': (
            '1967 yılında kurulan Hacettepe Üniversitesi, Türkiye\'nin ilk tıp fakültesini barındıran öncü kurumlardan '
            'biri oldu. Cumhuriyetin eğitime verdiği önemin somut yansıması olan bu üniversite, kısa sürede bölgenin '
            'en prestijli araştırma merkezlerinden biri hâline geldi. Çağdaş tıp ve bilimlerin Anadolu topraklarında '
            'kök salmasının simgesi olan Hacettepe, bugün hâlâ Türkiye\'nin en büyük üniversiteleri arasında yer almaktadır.'
        ),
        'location_lat': '39.866700',
        'location_lng': '32.732900',
        'location_name': 'Hacettepe Üniversitesi',
        'region': 'Ankara',
        'time_type': Story.TIME_EXACT,
        'year': 1967,
        'tags': ['cumhuriyet', 'culture'],
        'image_url': None,
    },

    # ── Izmir (4 stories) ──────────────────────────────────────────────────
    {
        'title': 'İzmir\'in Kurtuluşu',
        'narrative': (
            '9 Eylül 1922\'de Türk ordusu İzmir\'e girdi ve üç yılı aşkın süredir devam eden işgale son verdi. '
            'Zafer, Millî Mücadele\'nin fiilen sona erişinin habercisiydi. Kentin insanları Kordon boyunca toplanarak '
            'askerleri coşkuyla karşıladı. O günün heyecanı ve sevinç gözyaşları, İzmirlilerin kolektif belleğinde '
            'bugün de canlılığını korumaktadır.'
        ),
        'location_lat': '38.418500',
        'location_lng': '27.128800',
        'location_name': 'Kemeraltı, İzmir',
        'region': 'Izmir',
        'time_type': Story.TIME_DATE,
        'date_value': '1922-09-09',
        'tags': ['cumhuriyet', 'war', 'history'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/The_Turkish_Army%27s_entry_into_Izmir.jpg/960px-The_Turkish_Army%27s_entry_into_Izmir.jpg',
    },
    {
        'title': 'Ephesus: The Library of Celsus',
        'narrative': (
            'The Library of Celsus in ancient Ephesus was one of the greatest libraries of the ancient world, built '
            'around 117 AD as a tomb and library for Roman senator Tiberius Julius Celsus Polemaeanus. At its peak, '
            'it held over 12,000 scrolls. The façade, with its double-story columns and statues representing Wisdom, '
            'Knowledge, Intelligence, and Valor, was reconstructed in the 1970s and is today one of Turkey\'s most '
            'photographed ancient monuments.'
        ),
        'location_lat': '37.939700',
        'location_lng': '27.341500',
        'location_name': 'Efes Antik Kenti',
        'region': 'Izmir',
        'time_type': Story.TIME_EXACT,
        'year': 117,
        'tags': ['anadolu-tarihi', 'mimari', 'history'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Ephesus_Celsus_Library_Fa%C3%A7ade.jpg/960px-Ephesus_Celsus_Library_Fa%C3%A7ade.jpg',
    },
    {
        'title': 'Kadifekale: Hellenistik Dönemden Kalma Kale',
        'narrative': (
            'İzmir\'in tam ortasında yükselen Kadifekale, Büyük İskender\'in generali Lysimakhos tarafından M.Ö. 3. '
            'yüzyılda inşa edilmiştir. "Pagos" olarak da bilinen bu tepe, antik Smyrna şehrinin kalesidir. Bizans ve '
            'Osmanlı dönemlerinde de kullanılmaya devam eden kale, bugün İzmir\'in panoramik manzarasını sunan '
            'en güzel noktalardan biri hâline gelmiştir.'
        ),
        'location_lat': '38.413200',
        'location_lng': '27.143700',
        'location_name': 'Kadifekale',
        'region': 'Izmir',
        'time_type': Story.TIME_DECADE,
        'year': -300,
        'tags': ['anadolu-tarihi', 'bizans', 'mimari'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Kadifekale_IzmirTurkey_EUnluBlogspot.jpg/960px-Kadifekale_IzmirTurkey_EUnluBlogspot.jpg',
    },
    {
        'title': 'The Great Fire of Smyrna, 1922',
        'narrative': (
            'In September 1922, a devastating fire swept through the Greek and Armenian quarters of Smyrna (now Izmir), '
            'destroying much of the city. The fire broke out days after Turkish forces retook the city, and its origins '
            'remain disputed to this day. Thousands of civilians fled to the harbor. The catastrophe marked the end '
            'of the Greco-Turkish War and the beginning of a massive population exchange between Greece and Turkey.'
        ),
        'location_lat': '38.417300',
        'location_lng': '27.126900',
        'location_name': 'Alsancak, İzmir',
        'region': 'Izmir',
        'time_type': Story.TIME_EXACT,
        'year': 1922,
        'tags': ['history', 'war', 'anadolu-tarihi'],
        'image_url': None,
    },

    # ── Bursa (2 stories) ──────────────────────────────────────────────────
    {
        'title': 'Ulu Cami: Osmanlı\'nın İlk Büyük Eseri',
        'narrative': (
            'Bursa Ulu Camii, Sultan Yıldırım Bayezid tarafından 1399 yılında Niğbolu Savaşı\'nın zaferini kutlamak '
            'amacıyla yaptırılmıştır. Yirmi kubbe ve iki minaresiyle Osmanlı mimarisinin en erken büyük örneklerinden '
            'birini oluşturan cami, içindeki devasa şadırvanı ve zengin hat yazılarıyla ziyaretçileri büyülemektedir. '
            'Osmanlı cami mimarisinin gelişimini anlamak için Ulu Cami vazgeçilmez bir duraktır.'
        ),
        'location_lat': '40.183100',
        'location_lng': '29.060300',
        'location_name': 'Ulu Cami, Bursa',
        'region': 'Bursa',
        'time_type': Story.TIME_DECADE,
        'year': 1390,
        'tags': ['osmanlı', 'mimari', 'religion'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/71_Bursa_la_Grande_Moschea_%28Edited%29.jpg/960px-71_Bursa_la_Grande_Moschea_%28Edited%29.jpg',
    },
    {
        'title': 'Bursa and the Silk Road',
        'narrative': (
            'Bursa was one of the most important hubs of the Silk Road in the 14th century. As the first Ottoman capital, '
            'it attracted merchants from Persia, Central Asia, and Europe who traded silk, spices, and textiles. '
            'The city\'s covered markets, known as hans, date from this period. Bursa silk became famous across Europe '
            'and the city grew wealthy from this trade. The tradition of Bursa silk weaving continues to this day.'
        ),
        'location_lat': '40.187200',
        'location_lng': '29.058700',
        'location_name': 'Kapalı Çarşı, Bursa',
        'region': 'Bursa',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 1340,
        'tags': ['osmanlı', 'daily-life', 'culture'],
        'image_url': None,
    },

    # ── Trabzon (2 stories) ────────────────────────────────────────────────
    {
        'title': 'Trabzon Ayasofyası: Komnen Dönemi\'nden Freskler',
        'narrative': (
            'Trabzon Ayasofyası, 13. yüzyılda Trabzon Komnen İmparatorluğu döneminde inşa edilmiş olup benzersiz '
            'Bizans fresklerini barındırmaktadır. Bu freskler, Doğu Roma geleneğinin Karadeniz\'deki son parlak '
            'örneklerinden kabul edilmektedir. Osmanlı döneminde camiye, ardından müzeye dönüştürülen yapı, '
            '2013 yılında yeniden ibadete açılmıştır.'
        ),
        'location_lat': '41.005300',
        'location_lng': '39.718000',
        'location_name': 'Trabzon Ayasofya Camii',
        'region': 'Trabzon',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 1260,
        'tags': ['bizans', 'mimari', 'religion'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Trebisonda%2C_ex-chiesa_della_panagia_Chrysokephalos%2C_oggi_moschea_fatih%2C_esterno_01.jpg/960px-Trebisonda%2C_ex-chiesa_della_panagia_Chrysokephalos%2C_oggi_moschea_fatih%2C_esterno_01.jpg',
    },
    {
        'title': 'The Pontic Greeks: Civilization of the Black Sea Coast',
        'narrative': (
            'For over two millennia, the Pontic Greeks maintained a rich culture along the Turkish Black Sea coast. '
            'The Empire of Trebizond, founded in 1204 after the fall of Constantinople to the Crusaders, lasted until '
            '1461 — eight years longer than the Byzantine Empire itself. Pontic Greek communities in the region preserved '
            'distinct dialects, traditions, and religious practices. Their legacy is still visible in the region\'s '
            'churches, folk music, and place names.'
        ),
        'location_lat': '41.002400',
        'location_lng': '39.726700',
        'location_name': 'Trabzon Kalesi',
        'region': 'Trabzon',
        'time_type': Story.TIME_DECADE,
        'year': 1200,
        'tags': ['bizans', 'anadolu-tarihi', 'culture'],
        'image_url': None,
    },

    # ── Konya (2 stories) ──────────────────────────────────────────────────
    {
        'title': 'Mevlana\'nın Son Yılları',
        'narrative': (
            'Celaleddin Rumi, 1244\'te Şems-i Tebrizi ile karşılaşmasından sonra hayatının en verimli dönemini '
            'Konya\'da geçirdi. Şems\'in ardından yazdığı şiirler, Mesnevi\'ye giden yolun taşlarını döşedi. '
            '1273\'te Konya\'da hayatını kaybeden Rumi, bugün de en fazla okunan şairler arasında yer almaktadır. '
            'Onun dergâhı olan Mevlana Müzesi, her yıl milyonlarca ziyaretçi çekmektedir.'
        ),
        'location_lat': '37.871400',
        'location_lng': '32.504900',
        'location_name': 'Mevlana Türbesi, Konya',
        'region': 'Konya',
        'time_type': Story.TIME_EXACT,
        'year': 1273,
        'tags': ['selçuklu', 'religion', 'culture'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Maulana_Jelaledin_Muhammad_Rumi_in_konya.jpg/960px-Maulana_Jelaledin_Muhammad_Rumi_in_konya.jpg',
    },
    {
        'title': 'Çatalhöyük: The World\'s First City',
        'narrative': (
            'Çatalhöyük, located near Konya, is one of the world\'s oldest and best-preserved Neolithic settlements, '
            'inhabited from approximately 7500 to 5700 BCE. At its peak, it housed up to 8,000 people living in '
            'mud-brick houses packed so tightly together that residents entered through holes in the roof. '
            'The site contains the world\'s earliest known landscape painting and remarkable evidence of early '
            'religious rituals, including bull skulls mounted on walls and burials beneath house floors.'
        ),
        'location_lat': '37.668700',
        'location_lng': '32.826500',
        'location_name': 'Çatalhöyük Arkeoloji Alanı',
        'region': 'Konya',
        'time_type': Story.TIME_APPROXIMATE,
        'year': -7500,
        'tags': ['anadolu-tarihi', 'history', 'culture'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/%C3%87atalh%C3%B6y%C3%BCk%2C_7400_BC%2C_Konya%2C_Turkey_-_UNESCO_World_Heritage_Site%2C_08.jpg/960px-%C3%87atalh%C3%B6y%C3%BCk%2C_7400_BC%2C_Konya%2C_Turkey_-_UNESCO_World_Heritage_Site%2C_08.jpg',
    },

    # ── Edirne (2 stories) ─────────────────────────────────────────────────
    {
        'title': 'Selimiye Camii: Mimar Sinan\'ın Başyapıtı',
        'narrative': (
            'Selimiye Camii, Mimar Sinan\'ın kendi ifadesiyle "ustalık eserim" olarak nitelendirdiği yapıdır. '
            '1574 yılında tamamlanan cami, tek kubbe ve dört ince minaresiyle İslam mimarisinin zirvesi kabul '
            'edilmektedir. Kubbenin çapı Ayasofya\'nınkinden daha büyük olup bu başarı, Sinan\'ın mühendislik dehasını '
            'tüm dünyaya kanıtlamıştır. UNESCO Dünya Mirası Listesi\'ndeki cami, Edirne\'nin en önemli simgesidir.'
        ),
        'location_lat': '41.677700',
        'location_lng': '26.557800',
        'location_name': 'Selimiye Camii, Edirne',
        'region': 'Edirne',
        'time_type': Story.TIME_EXACT,
        'year': 1574,
        'tags': ['osmanlı', 'mimari', 'religion'],
        'image_url': None,
    },
    {
        'title': 'Kırkpınar: The Ancient Oil Wrestling Tradition',
        'narrative': (
            'Kırkpınar oil wrestling, held annually near Edirne, is one of the oldest continuously running sports '
            'events in the world. According to legend, it began around 1362 when forty Ottoman soldiers held a '
            'wrestling tournament and forty of them died from exhaustion — their graves giving the tournament its name '
            '(Kirk = forty, pınar = spring). Today, the festival attracts hundreds of wrestlers and thousands of '
            'spectators each July, and it has been inscribed on the UNESCO Intangible Cultural Heritage list.'
        ),
        'location_lat': '41.713400',
        'location_lng': '26.526200',
        'location_name': 'Kırkpınar, Edirne',
        'region': 'Edirne',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 1362,
        'tags': ['osmanlı', 'culture', 'daily-life'],
        'image_url': None,
    },

    # ── Mardin (1 story) ───────────────────────────────────────────────────
    {
        'title': 'Mardin: Aramice\'nin Son Kalesi',
        'narrative': (
            'Mardin, Mezopotamya ovasına hâkim taş evleri ve binlerce yıllık Arami kültürüyle Türkiye\'nin en özgün '
            'şehirlerinden biridir. 12. yüzyılda inşa edilen Kasımiye Medresesi ve çeşitli Süryani kiliseleri, '
            'şehrin çok katmanlı tarihini gözler önüne sermektedir. Bugün hâlâ konuşulan Aramice, İsa dönemine '
            'uzanan bir dilin yaşayan tanığıdır.'
        ),
        'location_lat': '37.311700',
        'location_lng': '40.733200',
        'location_name': 'Mardin Tarihi Çarşısı',
        'region': 'Mardin',
        'time_type': Story.TIME_DECADE,
        'year': 1200,
        'tags': ['anadolu-tarihi', 'religion', 'culture'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Mardin%2C_Mardin_Merkez-Mardin%2C_Turkey_-_panoramio_%281%29.jpg/960px-Mardin%2C_Mardin_Merkez-Mardin%2C_Turkey_-_panoramio_%281%29.jpg',
    },

    # ── Çanakkale (1 story) ────────────────────────────────────────────────
    {
        'title': 'Gallipoli: The Campaign That Shaped Nations',
        'narrative': (
            'The Gallipoli campaign of 1915 was one of the most significant military operations of World War I. '
            'Allied forces attempted to take the Dardanelles strait, knock the Ottoman Empire out of the war, and '
            'open a supply line to Russia. The campaign ended in Allied withdrawal after eight months of brutal '
            'fighting and over 130,000 deaths on both sides. For Australia and New Zealand, Gallipoli became a '
            'defining national moment. For Turkey, the defense of the peninsula, led by Mustafa Kemal, became the '
            'founding myth of the Republic.'
        ),
        'location_lat': '40.143200',
        'location_lng': '26.384900',
        'location_name': 'Gelibolu Yarımadası, Çanakkale',
        'region': 'Çanakkale',
        'time_type': Story.TIME_EXACT,
        'year': 1915,
        'tags': ['war', 'cumhuriyet', 'history'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/ANZAC_Cove.jpg/960px-ANZAC_Cove.jpg',
    },
]

# Merge personal stories so get_or_create deduplication handles re-runs safely
STORIES = STORIES + PERSONAL_STORIES

# ── Comments pool ───────────────────────────────────────────────────────────────

# Historical story comments
COMMENTS_TR = [
    'Çok etkileyici bir hikâye, teşekkürler!',
    'Bu tarihi bilgileri paylaştığınız için teşekkür ederim.',
    'Bölgeyi ziyaret etmek istiyorum artık.',
    'Harika anlatım, devamını da merak ediyorum.',
    'Bu konuda daha fazla araştırma yapacağım.',
    'Çok değerli bilgiler. Tarihi seviyorum.',
    'Fotoğraflar inanılmaz güzel olmuş.',
    'Ailemle birlikte görmek istiyorum kesinlikle.',
    'Kaleme aldığınız için teşekkürler.',
    'Gerçekten çok ilginç bir tarihi detay.',
]

COMMENTS_EN = [
    'Fascinating story, thank you for sharing!',
    'I visited this place last year, incredible atmosphere.',
    'Never knew this history, very educational.',
    'Adding this to my travel bucket list.',
    'The details here are amazing, well researched.',
    'Such an important piece of history.',
    'I would love to visit someday.',
    'Thank you for preserving this memory.',
    'Really brought the place to life for me.',
    'Wonderful storytelling, very informative.',
]

# Personal/nostalgic story comments
COMMENTS_PERSONAL_TR = [
    'Bu anıyı okuyunca içim sıkıştı, çok tanıdık geldi.',
    'Benim de böyle bir yerim var, tam anlayabildim sizi.',
    'Çocukluğumu hatırlattı, teşekkür ederim.',
    'Bu tür anıların kaybolmaması için çok önemli bir platform.',
    'Yazdığınız için mutlu oldum, kendinizi çok iyi ifade etmişsiniz.',
    'Okurken gözlerim doldu, çok güzel bir anı.',
    'Aynı duyguyu ben de yaşadım, kelimeleriniz beni çok etkiledi.',
    'İnsanın içini ısıtan bir yazı, elinize sağlık.',
    'Bu yeri ben de çok seviyorum, paylaştığınız için teşekkürler.',
    'Tam benim de anlatmak istediğim şeydi, siz yazdınız.',
]

COMMENTS_PERSONAL_EN = [
    'This made me think of my own childhood, beautifully written.',
    'I felt like I was right there with you reading this.',
    'Stories like this are exactly why this platform matters.',
    'The way you described this place gave me chills.',
    'Thank you for not letting this memory disappear.',
    'This is the kind of story that stays with you.',
    'I have a place just like this in my memory too.',
    'Reading this felt like opening an old photo album.',
    'So beautifully written, I could picture every moment.',
    'This is what community memory is all about, thank you.',
]

# Titles of personal stories — used to pick the right comment pool
_PERSONAL_TITLES = {s['title'] for s in PERSONAL_STORIES}


def _check_internet() -> bool:
    """Return True if Wikimedia upload servers are reachable."""
    try:
        req = urllib.request.Request(
            'https://upload.wikimedia.org',
            headers={'User-Agent': 'HistoryStoryMapSeed/1.0 (contact: demo@demo.com)'},
        )
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception:
        return False


def _download_image(url: str, filename: str):
    """Download an image from a URL; return None if unavailable."""
    import time
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'HistoryStoryMapSeed/1.0 (contact: demo@demo.com)'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        time.sleep(1)  # avoid Wikimedia rate limiting
        return ContentFile(data, name=filename)
    except (URLError, Exception):
        time.sleep(1)
        return None


class Command(BaseCommand):
    help = 'Seed demo data for final presentation'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing seed data before seeding')
        parser.add_argument('--no-images', action='store_true', help='Skip MediaItem creation')

    def handle(self, *args, **options):
        if options['clear']:
            self._clear_data()

        self._seed_tags()
        users = self._seed_users()
        self._seed_follows(users)
        stories = self._seed_stories(users)

        if not options['no_images']:
            self._seed_images(stories)
        self._seed_interactions(users, stories)

        self.stdout.write(self.style.SUCCESS('\nSeed complete.'))

    # ── Clear ────────────────────────────────────────────────────────────────

    def _clear_data(self):
        self.stdout.write('Clearing existing seed data...')
        from apps.gamification.models import PointTransaction, UserBadge
        from apps.notifications.models import Notification

        MediaItem.objects.all().delete()
        SavedStory.objects.all().delete()
        Like.objects.all().delete()
        Comment.objects.all().delete()
        StoryTag.objects.all().delete()
        Story.objects.all().delete()
        Follow.objects.all().delete()
        PointTransaction.objects.all().delete()
        UserBadge.objects.all().delete()
        Notification.objects.all().delete()
        Tag.objects.filter(is_predefined=False).delete()
        # Keep admin; delete seeded regular users
        User.objects.filter(email__in=[u['email'] for u in USERS if u.get('role') != 'admin']).delete()
        self.stdout.write('  Done.')

    # ── Tags ─────────────────────────────────────────────────────────────────

    def _seed_tags(self):
        created = 0
        for name in EXTRA_TAGS:
            _, is_new = Tag.objects.get_or_create(name=name, defaults={'is_predefined': True})
            if is_new:
                created += 1
        self.stdout.write(f'  Tags: {created} new extra tags created')

    # ── Users ─────────────────────────────────────────────────────────────────

    def _seed_users(self):
        users = []
        created = 0
        for data in USERS:
            user, is_new = User.objects.get_or_create(
                email=data['email'],
                defaults={
                    'username': data['username'],
                    'role': data.get('role', 'registered_user'),
                    'is_active': True,
                    'is_email_verified': True,
                    'is_staff': data.get('is_staff', False),
                    'is_superuser': data.get('is_superuser', False),
                },
            )
            if is_new:
                user.set_password(data['password'])
                user.save()
                created += 1
                award_registration_badge(user)

            UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'first_name': data.get('first_name', ''),
                    'last_name': data.get('last_name', ''),
                    'bio': data.get('bio', ''),
                    'location': data.get('location', ''),
                },
            )
            users.append(user)

        self.stdout.write(f'  Users: {created} new users created ({len(users)} total)')
        return users

    # ── Follows ───────────────────────────────────────────────────────────────

    def _seed_follows(self, users):
        regular = [u for u in users if not u.is_superuser]
        created = 0
        for user in regular:
            others = [u for u in regular if u != user]
            targets = random.sample(others, min(3, len(others)))
            for target in targets:
                _, is_new = Follow.objects.get_or_create(follower=user, followed=target)
                if is_new:
                    created += 1
        self.stdout.write(f'  Follows: {created} new follow edges created')

    # ── Stories ───────────────────────────────────────────────────────────────

    def _seed_stories(self, users):
        regular = [u for u in users if not u.is_superuser]
        stories = []
        created = 0

        for i, data in enumerate(STORIES):
            author = regular[i % len(regular)]
            story, is_new = Story.objects.get_or_create(
                title=data['title'],
                defaults={
                    'user': author,
                    'narrative': data['narrative'],
                    'location_lat': data['location_lat'],
                    'location_lng': data['location_lng'],
                    'location_name': data['location_name'],
                    'region': data.get('region', ''),
                    'time_type': data['time_type'],
                    'year': data.get('year'),
                    'year_start': data.get('year_start'),
                    'year_end': data.get('year_end'),
                    'date_value': data.get('date_value'),
                    'status': Story.STATUS_PUBLISHED,
                },
            )
            if is_new:
                created += 1
                award_points(author, STORY_PUBLISHED, story=story)

            # Tags
            for tag_name in data.get('tags', []):
                tag = Tag.objects.filter(name=tag_name).first()
                if tag:
                    StoryTag.objects.get_or_create(story=story, tag=tag)

            stories.append((story, data.get('image_url')))

        self.stdout.write(f'  Stories: {created} new stories created')
        return stories

    # ── Images ────────────────────────────────────────────────────────────────

    def _seed_images(self, stories):
        created = 0
        skipped = 0
        for story, image_url in stories:
            if not image_url:
                skipped += 1
                continue
            if MediaItem.objects.filter(story=story).exists():
                continue
            content = _download_image(image_url, f'seed_{story.pk}.jpg')
            if content is None:
                skipped += 1
                continue
            media = MediaItem(
                story=story,
                media_type=MediaType.IMAGE,
                file_size=len(content),
                original_filename=f'seed_{story.pk}.jpg',
                order=0,
            )
            media.file.save(f'seed_{story.pk}.jpg', content, save=True)
            created += 1

        self.stdout.write(f'  Images: {created} downloaded, {skipped} skipped (no URL or download failed)')

    # ── Interactions ──────────────────────────────────────────────────────────

    def _seed_interactions(self, users, stories):
        regular = [u for u in users if not u.is_superuser]
        comment_count = 0
        like_count = 0
        save_count = 0

        for story, _ in stories:
            author = story.user

            # Comments — use story-specific list when available, else fall back to pool
            commenters = random.sample(regular, random.randint(1, min(4, len(regular))))
            is_personal = story.title in _PERSONAL_TITLES
            specific_comments = STORY_COMMENTS.get(story.title)
            if specific_comments:
                shuffled = random.sample(specific_comments, min(len(commenters), len(specific_comments)))
                comment_iter = iter(shuffled + random.sample(specific_comments, max(0, len(commenters) - len(shuffled))))
            else:
                comment_iter = None
            for commenter in commenters:
                if comment_iter is not None:
                    text = next(comment_iter)
                elif is_personal:
                    pool = COMMENTS_PERSONAL_TR if random.random() < 0.6 else COMMENTS_PERSONAL_EN
                    text = random.choice(pool)
                else:
                    pool = COMMENTS_TR if random.random() < 0.6 else COMMENTS_EN
                    text = random.choice(pool)
                _, is_new = Comment.objects.get_or_create(
                    story=story,
                    author=commenter,
                    defaults={'text': text},
                )
                if is_new:
                    comment_count += 1
                    award_points(commenter, USER_COMMENTED, story=story)
                    if author and author != commenter:
                        award_points(author, STORY_COMMENTED, story=story)

            # Likes
            likers = random.sample(regular, random.randint(2, min(7, len(regular))))
            for liker in likers:
                _, is_new = Like.objects.get_or_create(user=liker, story=story)
                if is_new:
                    like_count += 1
                    award_points(liker, USER_LIKED, story=story)
                    if author and author != liker:
                        award_points(author, STORY_LIKED, story=story)

            # Saves
            savers = random.sample(regular, random.randint(0, min(3, len(regular))))
            for saver in savers:
                _, is_new = SavedStory.objects.get_or_create(user=saver, story=story)
                if is_new:
                    save_count += 1
                    award_points(saver, STORY_SAVED, story=story)

        self.stdout.write(
            f'  Comments: {comment_count} | Likes: {like_count} | Saves: {save_count}'
        )
