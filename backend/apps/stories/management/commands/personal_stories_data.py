"""
Personal, everyday, and emotionally meaningful seed stories.
Imported by seed_data.py and appended to the main STORIES list.
All locations are Turkey-based; dates skew toward 2000s–2020s.
"""

from apps.stories.models import Story

PERSONAL_STORIES = [
    # ── Istanbul — personal & neighborhood ─────────────────────────────────
    {
        'title': 'Büyükada\'ya İlk Vapurla',
        'narrative': (
            'Her yaz, babam işten izin alır almaz ailemiz Kadıköy\'den vapura binerdi. Büyükada\'ya giderdik. Ben küçüktüm '
            've her seferinde sanki ilk kez gidiyormuşum gibi heyecanlanırdım. Vapurun güvertesinde durur, saçlarıma çarpan '
            'deniz rüzgârını hisseder, martıların peşimizden uçuşunu izlerdim. Ellerimde annemin koyduğu limonlu poşet '
            'kek, yanımda küçük kardeşim. İstanbul arka planda küçülürken önümde ada büyürdü.\n\n'
            'Adaya vardığımızda ilk işimiz faytonla turu dolaşmak olurdu. At ayak seslerinin taş kaldırımlarda yankılanması, '
            'çam ağaçlarının arasından süzülen ışık ve denize bakan ahşap köşkler — bunların hepsi birleşerek o ada havasını '
            'yaratırdı. Öğle yemeğini kıyıdaki balık restoranında yerdik. Babam her seferinde aynı yere gitmekte ısrar ederdi. '
            '"Buranın manzarası başka," derdi. Ben de itiraz etmezdim. Haklıydı.\n\n'
            'Yıllar geçtikçe adaya gitme sıklığımız azaldı. Ama Büyükada kelimesini duyduğumda hâlâ o vapur güvertesinde '
            'olurum. Rüzgârı hissederim. Martıları görürüm. Bazı anılar fotoğraf gibi değil, his gibi saklıdır içimizde.'
        ),
        'location_lat': '40.869500',
        'location_lng': '29.124700',
        'location_name': 'Büyükada, Adalar',
        'region': 'Istanbul',
        'time_type': Story.TIME_DECADE,
        'year': 1995,
        'tags': ['childhood', 'daily-life', 'family', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/B%C3%BCy%C3%BCkada_istanbul_t%C3%BCrkiye_-_panoramio.jpg/960px-B%C3%BCy%C3%BCkada_istanbul_t%C3%BCrkiye_-_panoramio.jpg',
    },
    {
        'title': 'Kadıköy Pazarında Büyükannem',
        'narrative': (
            'Büyükannem her cumartesi sabahı erken kalkar, bez çantasını alır ve Kadıköy pazarına giderdi. Ben de '
            'peşine takılırdım. O zamanlar küçüktüm ama pazarın sesini, kokusunu, rengini hiç unutmadım. Satıcıların '
            'bağırması, taze balık kokan tezgâhlar, sebzelerin üzerindeki su damlaları, büyükannemin alışveriş yaparken '
            'tezgâhtarlarla sohbet etmesi… Herkes birbirini tanıyordu. Herkes birbirine bir şeyler soruyordu.\n\n'
            'Büyükannem domates alırken her birini sıkarak kontrol ederdi. "Sert olursa olmuş değil, çürük olursa geç '
            'kalmış," derdi. Ben yanında durur ve bu küçük dersi kafama kazırdım. Pazar bittikten sonra eve dönerken '
            'bir simitçiden simit alırdık. Oturur, denize karşı yerdik. Büyükannem hiçbir şey söylemezdi. Ben de '
            'söylemezdim. Sadece otururduk.\n\n'
            'Büyükannem artık o pazarlara gidemeyecek kadar yaşlandı. Ama ben hâlâ Kadıköy pazarına her gittiğimde '
            'domates tezgâhının önünde durur, içimden onun sesini duyarım. Bazı insanlar yerlere değil, anılara gömülür.'
        ),
        'location_lat': '40.989900',
        'location_lng': '29.026000',
        'location_name': 'Kadıköy Salı Pazarı',
        'region': 'Istanbul',
        'time_type': Story.TIME_DECADE,
        'year': 2003,
        'tags': ['food', 'childhood', 'family', 'neighborhood'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Istanbul_-_Kad%C4%B1k%C3%B6y_%2855107618018%29.jpg/960px-Istanbul_-_Kad%C4%B1k%C3%B6y_%2855107618018%29.jpg',
    },
    {
        'title': 'Haydarpaşa\'da Son Tren',
        'narrative': (
            'Haydarpaşa Garı kapılarını trenlere kapattığında ben üniversitenin son yılındaydım. Haberini '
            'sosyal medyadan öğrendim ama gerçekten hissettiğim gün oraya gittiğimde oldu. Boş peronlar, '
            'kapalı kapılar ve yıllar önce tren sesiyle dolup taşan o büyük salon — şimdi sessizdi.\n\n'
            'Aklıma hep aynı sahne gelir: Lise biterken, babam beni askeri lise sınavı için trene bindirmişti. '
            'Sabah erkendi. Peronun ucunda durup el sallarken arkama bakmamıştım. O anı nasıl bu kadar net '
            'hatırladığımı bilemiyorum. Belki çünkü o gün çok büyümüştüm, farkında olmadan.\n\n'
            'Haydarpaşa artık restore ediliyor. Birkaç yıla otel ya da müze olacakmış. Belki güzel olacak. '
            'Ama bir garın ruhu trenlerinden gelir, değil mi? Lokomotif sesi olmayan bir tren garı, perde '
            'kapanmış bir tiyatroya benzer. Onun için ben onu en çok, kapıları kapanmadan önceki hâliyle '
            'hatırlıyorum.'
        ),
        'location_lat': '40.999800',
        'location_lng': '29.021300',
        'location_name': 'Haydarpaşa Garı, Kadıköy',
        'region': 'Istanbul',
        'time_type': Story.TIME_DATE,
        'date_value': '2013-10-29',
        'tags': ['nostalgia', 'history', 'daily-life'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Haydarpasa_train_station.jpg/960px-Haydarpasa_train_station.jpg',
    },
    {
        'title': 'Ortaköy\'de Kumpir ve Boğaz',
        'narrative': (
            'Üniversitede okurken neredeyse her hafta sonu Ortaköy\'e giderdik. Öğrenci bütçesiyle kumpir '
            'almak hem ucuzdu hem de bir ritüele dönüşmüştü. Tezgâhın başında sıra bekler, kumpiri alır, '
            'köprünün gölgesinde kıyıya otururduk. Sohbet ederken bazen vapur geçerdi, bazen bir tekne. '
            'Biz konuşmaya devam ederdik.\n\n'
            'O zamanlar hiçbirimiz ne yapacağımızı bilmiyorduk. Hangi şehirde yaşayacaktık, ne iş bulacaktık, '
            'kimlerle beraber olacaktık — hiçbiri belli değildi. Ama Ortaköy\'de kıyıda otururken bu belirsizlik '
            'hafiflerdi. Boğaz\'a bakardık, rüzgâr eserdi ve bir süreliğine yeterliydi.\n\n'
            'Şimdi o arkadaşların bir kısmı yurt dışında, bir kısmı başka şehirlerde. Ortaköy\'den geçtiğimde '
            'hâlâ kumpir alırım. Aynı köşede otururum. Ama artık içim sıkışır biraz. O yıllar döndürülemeyecek '
            'kadar geriye gitti. Boğaz aynı, kumpir aynı, ama biz artık o öğrenciler değiliz.'
        ),
        'location_lat': '41.047700',
        'location_lng': '29.027700',
        'location_name': 'Ortaköy Meydanı, Beşiktaş',
        'region': 'Istanbul',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 2016,
        'tags': ['food', 'youth', 'nostalgia', 'daily-life'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Ortakoy_mosque_-_panoramio.jpg/960px-Ortakoy_mosque_-_panoramio.jpg',
    },
    {
        'title': 'Moda\'da Sonbahar Yürüyüşleri',
        'narrative': (
            'Üniversiteyi bitirdikten sonra birkaç ay hiçbir şey yapamadım. İş ararken, kendinizi kaybetmiş '
            'hissedebilirsiniz — bu benim o dönemimin hissiydi. Moda Sahili\'ne yürümeye başlamam da o dönemde '
            'oldu. Her öğleden sonra, amaçsızca kıyı boyunca yürürdüm.\n\n'
            'Moda\'nın o saatlerde bir huzuru vardır. Köpekler koşar, yaşlı çiftler kıyıda oturur, çocuklar '
            'denize taş atar. Kimse birbirine bakmaz, herkes kendi içindedir. Ben de öyleydim. Yürür, '
            'Boğaz\'a karşı Kız Kulesi\'ni görür ve durur, sonra tekrar yürürdüm.\n\n'
            'O dönem geçti. Bir iş buldum, hayat devam etti. Ama Moda Sahili\'ne o yürüyüşlerin bende bıraktığı '
            'şeyi — durabilme, nefes alabilme, amaçsızlığı bir süre için kabul etme — hâlâ taşıyorum. Bazen '
            'en iyi şeyleri en zor dönemlerde öğrenirsiniz.'
        ),
        'location_lat': '40.982900',
        'location_lng': '29.030700',
        'location_name': 'Moda Sahili, Kadıköy',
        'region': 'Istanbul',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 2019,
        'tags': ['nostalgia', 'daily-life'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Moda_sahili_-_panoramio.jpg/960px-Moda_sahili_-_panoramio.jpg',
    },
    {
        'title': 'Karaköy\'de Sabah, Vapur Beklerken',
        'narrative': (
            'Yıllar boyunca her sabah Karaköy İskelesi\'nde babamı beklerdim. Babam Anadolu yakasında çalışır, '
            'akşamları vapurla dönerdi. Ben ilkokuldayken anneme söylemeden iskeleden koşardım. Babam vapurdan '
            'indiğinde yüzü her zaman yorgundu ama beni görünce gülerdi. Elimi tutardı, eve yürürdük.\n\n'
            'O yürüyüşlerde çok konuşmazdık. Babam ağırbaşlı bir adamdı. Ama yanında olmak yeterliydi. '
            'İskele, deniz kokusu, martı sesleri ve babamın büyük eli — bunlar beraber bir şey ifade ederdi. '
            'Güvende olduğumu hissederdim.\n\n'
            'Karaköy bugün çok değişti. Kafeler, butikler, sanat galerileri… Baba o mahalleleri neredeyse '
            'tanımıyor artık. Ben de o küçük çocuğu. Ama o iskelede durduğumda içimde hâlâ bir yerden '
            '"babam az sonra gelecek" hissi uyanıyor. Bazı şeyler gitmez.'
        ),
        'location_lat': '41.022600',
        'location_lng': '28.973400',
        'location_name': 'Karaköy İskelesi, Beyoğlu',
        'region': 'Istanbul',
        'time_type': Story.TIME_DECADE,
        'year': 1998,
        'tags': ['childhood', 'family', 'daily-life', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Karak%C3%B6y_Mars_2013.jpg/960px-Karak%C3%B6y_Mars_2013.jpg',
    },
    {
        'title': 'Balat Sokaklarında Kaybolmak',
        'narrative': (
            'Balat\'a ilk gittiğimde bir arkadaşımla sırf "görelim" diye gitmiştik. Harita bakmadan yürümeye '
            'karar verdik. Dar sokaklar, renkli ahşap evler, duvarlara yaslanmış yaşlılar, kaldırım taşları '
            'arasından fırlayan yabani otlar… İstanbul\'un içinde başka bir İstanbul vardı.\n\n'
            'Bir köşeyi döndük, küçük bir kilise çıktı karşımıza. Kapısı açıktı. İçerisi boştu ama mumlar '
            'yanıyordu. Birkaç dakika sustuk. Sonra çıktık ve yürümeye devam ettik. Bir Rum kahvaltı yeri '
            'bulduk, girdik. Sahibi uzun zamandır burada olduğunu, babasından devredildiğini anlattı. '
            'Çayımızı içerken aklımdan geçti: bu mahallenin her taşının bir hikâyesi var, ve çoğunu kimse '
            'bilmiyor artık.\n\n'
            'O gün Balat\'ta iki saat kaybolmak, bana İstanbul hakkında hiçbir gezi rehberinin veremeyeceği '
            'bir şeyi verdi. Tarihin yüzü her zaman müzelerde değil; bazen dar bir sokakta, açık bir kapıda, '
            'yaşlı bir adamın gülümsemesinde gizlidir.'
        ),
        'location_lat': '41.027100',
        'location_lng': '28.950200',
        'location_name': 'Balat, Fatih',
        'region': 'Istanbul',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 2017,
        'tags': ['culture', 'daily-life', 'history', 'neighborhood'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Istanbul_Balat_2022.jpg/960px-Istanbul_Balat_2022.jpg',
    },
    {
        'title': 'Boğaz Vapurundan Her Sabah',
        'narrative': (
            'Kadıköy\'den Eminönü\'ne her sabah vapur alırdım. İnsanlar bunu sıradan bir ulaşım aracı gibi '
            'kullanır. Ben de öyle kullanırdım, bir süre. Sonra bir gün martıları izledim. Sonra güneşin '
            'Boğaz\'a vurduğu o anlık parlamayı fark ettim. Ardından çayımı aldım ve güverteye çıktım. '
            'O günden sonra bir daha içeride oturmadım.\n\n'
            'Kışın soğuk olurdu. Elleri ceplere sokup denize bakardım. Sabahın erken saatinde vapur '
            'neredeyse boştu. Sadece birkaç kişi vardı: gazete okuyanlar, telefona bakanlar, benim gibi '
            'sadece duranlar. Herkes kendi sessizliğindeydi. İstanbul ise kıyıdan kıyıya uzanırdı.\n\n'
            'O işten ayrıldığımda en çok vapuru özledim. Sonra fark ettim ki aslında özlediğim, her sabah '
            'biraz nefes alabildiğim o on beş dakikaydı. Şehir ne kadar hızlı olursa olsun, Boğaz geçişi '
            'sizi yavaşlatır. Bu da nadir bir şeydir.'
        ),
        'location_lat': '41.008200',
        'location_lng': '28.978400',
        'location_name': 'Eminönü İskelesi',
        'region': 'Istanbul',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 2018,
        'tags': ['daily-life', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Eminonu_Bosphorus_view_in_Istanbul.jpg/960px-Eminonu_Bosphorus_view_in_Istanbul.jpg',
    },
    {
        'title': 'The First Time I Saw Istanbul',
        'narrative': (
            'I came to Istanbul for the first time when I was eighteen, to start university. I had grown up in '
            'a small city on the Aegean coast and had never lived anywhere with more than a few hundred thousand '
            'people. The bus pulled into Esenler at dawn and I carried my single suitcase out into the noise '
            'and the crowd and the smell of the city — exhaust, simit, something wet from the night before. '
            'I had no idea where I was.\n\n'
            'A classmate I had never met in person was waiting to show me the way to the dormitory. We took '
            'the metro, then the tram, and when the tram crossed the Galata Bridge and I saw the Golden Horn '
            'and the mosques and the morning light falling across the water, I forgot I was tired. I pressed '
            'my face to the tram window like a child. My classmate laughed and said, "You get used to it." '
            'I never did.\n\n'
            'That was more than ten years ago. Istanbul has become home in the way only a city you did not '
            'choose at birth can become home — slowly, stubbornly, in spite of everything. But sometimes I '
            'still catch myself looking at the Bosphorus the way I did that first morning. Some first sights '
            'you carry forever.'
        ),
        'location_lat': '41.016800',
        'location_lng': '28.974400',
        'location_name': 'Galata Köprüsü',
        'region': 'Istanbul',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 2013,
        'tags': ['youth', 'daily-life', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Istanbul_-_Galata_Bridge_%2855126552769%29.jpg/960px-Istanbul_-_Galata_Bridge_%2855126552769%29.jpg',
    },
    {
        'title': 'Üsküdar\'da Bir Mahalle Fırını',
        'narrative': (
            'Çocukluğumun geçtiği Üsküdar\'da, sokağımızın başında küçük bir fırın vardı. Sabahları erkenden '
            'açılırdı. Okuldan önce ekmek almaya giderken dışarıdan bile hissedilirdi sıcaklığı. Fırıncı amca '
            'beni her zaman tanırdı. "Ailenin küçüğü" derdi ve bazen fazladan bir poğaça verirdi.\n\n'
            'Mahallenin neredeyse tüm sakinleri o fırından ekmek alırdı. Sabah kuyrukları kısa ama canlıydı. '
            'İnsanlar hem ekmek hem haber alırdı. Komşular orada buluşur, kısa sohbetler ederdi. Fırın sadece '
            'ekmek satan bir yer değildi — mahallenin günlük ritmi oradan başlardı.\n\n'
            'Üniversite için İstanbul\'dan ayrıldığımda o fırın hâlâ açıktı. Yıllarca sonra döndüğümde kapısı '
            'kilitliydi. Bir "Kiralık" yazısı asılıydı. Fırıncı amca gitmişti, oğullar başka işler kurmuş. '
            'Sokakta o koku yoktu artık. Bazı yerlerin eksiği sadece binayla değil, insanlarla kapanır.'
        ),
        'location_lat': '41.023300',
        'location_lng': '29.014300',
        'location_name': 'Üsküdar, Istanbul',
        'region': 'Istanbul',
        'time_type': Story.TIME_DECADE,
        'year': 2000,
        'tags': ['childhood', 'food', 'neighborhood', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/Fishermen_in_%C3%9Csk%C3%BCdar.jpg/960px-Fishermen_in_%C3%9Csk%C3%BCdar.jpg',
    },

    # ── Ankara — personal ──────────────────────────────────────────────────
    {
        'title': 'Ankara\'da Öğrenci Olmak: Kızılay Sokakları',
        'narrative': (
            'Ankara\'ya geldiğimde şehri sevemedim. Soğuktu, rüzgârlıydı ve İstanbul\'a göre çok sessizdi. '
            'Ama zamanla o sessizliğe alıştım. Kızılay\'ın sokaklarını yürüyerek öğrendim. Küçük kitapçılar, '
            'öğrenci kantinleri, kahvehaneler — bunlar benim şehrime dönüştü.\n\n'
            'Sınavlardan önce Sakarya Caddesi\'ndeki kafelerden birine gider, saatlerce çalışırdım. Masalar '
            'küçüktü, gürültü vardı, ama orası güvenli hissettirirdi. Yanı başımda da başka öğrenciler '
            'vardı, her biri kendi kitabına dalmış. Bir dayanışma vardı söylenmeden aramızda.\n\n'
            'Üniversiteden mezun olunca Ankara\'dan ayrıldım. Ama o sokaklarda geçen yıllar bende kaldı. '
            'Bazen rüyalarımda Kızılay\'ın o eski kafelerinden birindeyim, sınavdan önce kahve içiyorum. '
            'Uyanınca birkaç saniye nerede olduğumu bilemiyorum. Sonra hatırlıyorum: o yıllar geçti. '
            'Ama geçmemiş gibi hissettirdikleri için güzel sayıyorum.'
        ),
        'location_lat': '39.919300',
        'location_lng': '32.854300',
        'location_name': 'Kızılay, Ankara',
        'region': 'Ankara',
        'time_type': Story.TIME_DECADE,
        'year': 2008,
        'tags': ['youth', 'daily-life', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/K%C4%B1z%C4%B1lay_Square_001.jpg/960px-K%C4%B1z%C4%B1lay_Square_001.jpg',
    },

    # ── Izmir — personal ───────────────────────────────────────────────────
    {
        'title': 'İzmir Kordon\'u\'nda Akşam Yürüyüşleri',
        'narrative': (
            'İzmir\'de büyüdüm. Kordon, çocukluğumun ve gençliğimin sahnesiydi. Yazın akşamları ailece '
            'çıkardık, kıyı boyunca yürürdük. Babam dondurma alırdı, ben sahile taş atardım. Deniz '
            'hâlâ ılıktı, güneş yavaşça batardı ve şehrin silüeti pembeye dönerdi.\n\n'
            'Lise yıllarında aynı yerde arkadaşlarımla buluşurduk. Konuşurduk, güler, tartışırdık. '
            'Geleceğimizi planlardık — o zamanlar her şey mümkün görünürdü. Karşı kıyıda Karşıyaka\'nın '
            'ışıkları yanardı, vapurlar gidip gelirdi ve biz hâlâ konuşurduk, gece ilerleyene kadar.\n\n'
            'Kordon bugün de aynı yerde. Dükkânlar değişti, insanlar değişti, ama o akşam yürüyüşlerinin '
            'ritmi değişmedi. Her ziyaretimde bir tur atarım. Deniz aynı kokuyu verir. Ve ben yeniden '
            'hem o çocuk hem de şimdiki halim olurum — ikisi aynı anda, aynı kıyıda.'
        ),
        'location_lat': '38.434700',
        'location_lng': '27.142700',
        'location_name': 'Kordon, Alsancak, İzmir',
        'region': 'Izmir',
        'time_type': Story.TIME_DECADE,
        'year': 2010,
        'tags': ['childhood', 'family', 'daily-life', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/TR_Izmir_asv2020-02_img16_Alsancak_seaside.jpg/960px-TR_Izmir_asv2020-02_img16_Alsancak_seaside.jpg',
    },

    # ── Anadolu — kişisel hikayeler ───────────────────────────────────────
    {
        'title': 'Kapadokya\'da Şafak: Balon Sesi',
        'narrative': (
            'Kapadokya\'ya ilk gittiğimde yirmili yaşlarımın başındaydım. Üniversite arkadaşlarımla '
            'son dakika karar vermiş, bir gece otobüsüyle yola çıkmıştık. Göreme\'ye sabahın '
            'erken saatlerinde vardık. Yorgunken bile peri bacalarını görünce uyku kaçtı. '
            'Hiçbirimiz böyle bir yerin gerçekten var olabileceğini tam olarak içselleştirememişti.\n\n'
            'Sabah şafak sökerken, otel penceresinden dışarı baktım. Gökyüzü balonlarla doluydu. '
            'Onlarca renkli balon, pembeye dönmekte olan ufkun önünde süzülüyordu. Hiç ses yoktu '
            'odada. Sadece uzaktan, rüzgârla gelen bir alev sesi. O an için hiçbir şey '
            'söylemedim. Söylemeye gerek yoktu.\n\n'
            'O seyahatten yıllar geçti. Kapadokya fotoğraflarını her gördüğümde o sabahı hatırlarım. '
            'Balonları değil aslında — o sessizliği, o pencereyi, henüz hiçbir şeyin '
            'başlamadığı ama her şeyin güzel olacağını hissettiğim o anı.'
        ),
        'location_lat': '38.643700',
        'location_lng': '34.828600',
        'location_name': 'Göreme, Kapadokya',
        'region': 'Nevşehir',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 2014,
        'tags': ['nostalgia', 'youth', 'culture'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Kapadokya%27da_havadaki_balonlar_2.jpg/960px-Kapadokya%27da_havadaki_balonlar_2.jpg',
    },
    {
        'title': 'Gaziantep\'te Büyükannemin Baklavası',
        'narrative': (
            'Gaziantep\'e her gittiğimde ilk durağım büyükannemin eviydi. Kapıyı açar açmaz '
            'fıstık ve tereyağı kokusu çarpardı yüzüme. Büyükannem mutfakta, hamurla uğraşıyor '
            'olurdu. Yıllardır aynı tezgah, aynı oklava, aynı eller. Ben yanına oturur, '
            'izlerdim. Konuşmazdık çok. Ama o mutfakta geçen saatler, hayatımın en huzurlu '
            'anları arasında yer alıyor.\n\n'
            'Baklavayı katlarken her hamurun arasına sürdüğü tereyağını, tepsiye dizerken '
            'gösterdiği özeni hiç unutamam. "İşin sırrı acelesi olmamakta," derdi. Ben de '
            'başka bir şey anlatıyor gibi dinlerdim onu — sadece baklava tarifi değil, '
            'bir yaşam biçimini aktarıyordu bana.\n\n'
            'Büyükannem birkaç yıl önce vefat etti. O ev artık başkalarında. Ama Gaziantep\'e '
            'her gittiğimde çarşıdan geçer, bir baklava dükkanının önünde dururum. İçeri '
            'girip alırım. Ve ilk ısırıkta, ne kadar iyi olursa olsun, hep aynı şeyi '
            'düşünürüm: büyükannemin yaptığı gibisi olmaz.'
        ),
        'location_lat': '37.061000',
        'location_lng': '37.383500',
        'location_name': 'Bakırcılar Çarşısı, Gaziantep',
        'region': 'Gaziantep',
        'time_type': Story.TIME_DECADE,
        'year': 2005,
        'tags': ['food', 'family', 'childhood', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Gaziantep_Bedesten_Sokak_in_2024_8051.jpg/960px-Gaziantep_Bedesten_Sokak_in_2024_8051.jpg',
    },
    {
        'title': 'Eskişehir\'de Porsuk Kıyısında Öğrencilik',
        'narrative': (
            'Eskişehir\'e üniversite için geldiğimde şehri hiç bilmiyordum. İlk hafta '
            'kayboldum, doğrusu. Ama Porsuk Çayı\'nı bulduğumda bir nefes aldım. Nehir boyunca '
            'yürümek, kafelerin önündeki sandalyelere oturmak, gondol turistlerini izlemek — '
            'bu şehrin ritmine alışmak böyle oldu.\n\n'
            'Sınav dönemlerinde nehir kenarındaki kafelerde çalışırdım. Kışın soğuk olurdu, '
            'camlar buğulanırdı, içeride çay kokusu vardı. Yanı başımda de başka öğrenciler '
            'vardı, herkes bir şeylere yetişmeye çalışıyordu. O kaygılı ama bir o kadar da '
            'canlı atmosfer — şimdi özlediğim şeylerden biri.\n\n'
            'Eskişehir\'den mezun olup ayrıldığımda arkama bakmadan gittim. Ama yıllar sonra '
            'bir iş seyahatinde şehre uğradım. Porsuk\'a yürüdüm, aynı köprünün üstünde durdum. '
            'Nehir aynı akıyordu. Ben değişmiştim. Ve o an fark ettim ki bazı şehirler sizi '
            'büyütür — farkında bile olmadan.'
        ),
        'location_lat': '39.776700',
        'location_lng': '30.520600',
        'location_name': 'Porsuk Çayı, Eskişehir',
        'region': 'Eskişehir',
        'time_type': Story.TIME_DECADE,
        'year': 2010,
        'tags': ['youth', 'daily-life', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Bridge_over_Porsuk%2C_Eski%C5%9Fehir_01.jpg/960px-Bridge_over_Porsuk%2C_Eski%C5%9Fehir_01.jpg',
    },
    {
        'title': 'Antalya Kaleiçi\'nde Kaybolmak',
        'narrative': (
            'Antalya\'ya iş için gitmiştim. Toplantılar bitti, akşam vaktim vardı. Otelden '
            'çıkıp yürümeye başladım. Nasıl olduysa Kaleiçi sokaklarına daldım. Dar taş '
            'sokaklar, sarmaşıklarla kaplı duvarlar, aralarda açılan küçük avlular… '
            'Her köşeyi döndüğümde başka bir şey çıkıyordu karşıma.\n\n'
            'Limana kadar yürüdüm. Roma döneminden kalma kapıdan geçtim, karşımda Akdeniz '
            'açıldı. Güneş batıyordu. Tekneler usulca sallanıyordu. Yaşlı bir adam '
            'iskelede oturmuş, balık tutuyordu. Yanına oturdum, konuştuk. Yıllardır '
            'burada yaşıyormuş. "Şehir değişti ama liman hep aynı kaldı," dedi.\n\n'
            'O gece otele dönerken aklımda kaldı o söz. Bazı yerler değişimin içinde '
            'bir şeyi sabit tutar — bir kokuyu, bir ışığı, bir sesi. Kaleiçi benim için '
            'artık o akşamın rengiyle hatırlanacak. Hiç planlamadan yaşanan anlar '
            'çoğu zaman en güzel olanlar.'
        ),
        'location_lat': '36.886700',
        'location_lng': '30.700600',
        'location_name': 'Kaleiçi, Antalya',
        'region': 'Antalya',
        'time_type': Story.TIME_APPROXIMATE,
        'year': 2021,
        'tags': ['daily-life', 'nostalgia', 'culture'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/20180111_AntalyaMarina_5296_%2826236632848%29.jpg/960px-20180111_AntalyaMarina_5296_%2826236632848%29.jpg',
    },
    {
        'title': 'Diyarbakır Surlarının Gölgesinde Büyümek',
        'narrative': (
            'Diyarbakır\'da doğup büyüdüm. Siyah bazalt surlar benim için hep oradaydı — '
            'o kadar oradaydı ki bir süre sonra görmez olurdum. Çocukken surların dibinde '
            'koşar, taşların arasındaki yarıklara merakla bakardım. Büyükler "oraya girme" '
            'derdi. Ben yine de bakardım.\n\n'
            'Surların içi bambaşka bir dünyaydı. Dar sokaklar, taş evler, avlulardan '
            'yükselen sesler. Komşular birbirini tanırdı. Mahalle bir aile gibiydi. '
            'Annem çamaşırları asarken komşuyla konuşurdu, sesi sokağa yayılırdı. '
            'O sesler şehrin dokusuyla iç içe geçmişti.\n\n'
            'Yıllar sonra UNESCO Diyarbakır surlarını Dünya Mirası ilan etti. Haberini '
            'başka bir şehirde okuyunca garip hissettim. Benim için onlar hep zaten '
            'mirastı — ama resmi değil, kişisel. Çocukluğumun gölgesiydi. Ve o gölgeyi '
            'hiçbir unvan kadar iyi anlatamazsınız.'
        ),
        'location_lat': '37.924400',
        'location_lng': '40.228600',
        'location_name': 'Diyarbakır Surları',
        'region': 'Diyarbakır',
        'time_type': Story.TIME_DECADE,
        'year': 1995,
        'tags': ['childhood', 'neighborhood', 'history', 'nostalgia'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Da%C4%9Fkap%C4%B1_Meydan%C4%B1_surlar.jpg/960px-Da%C4%9Fkap%C4%B1_Meydan%C4%B1_surlar.jpg',
    },

    # ── Istanbul Airport — dönüşüm hikayeleri ─────────────────────────────
    {
        'title': 'Kulakçayır Gölü: Pistin Altındaki Anılar',
        'narrative': (
            'Tayakadın\'da büyüdüm. Köyümüzün tam orta yerinde Kulakçayır Gölü vardı. Küçükken babamla '
            'sabah erkenden o gölün kıyısına giderdik. Su mandaları ağır adımlarla kıyıya iner, '
            'sazlıklar arasında duruverirdi. Gölün yüzeyi sabah sisinin altında neredeyse kaybolurdu. '
            'Köyün beş yüz altı yüz mandası orada otlardı. Bu bir geçim kaynağı değil, bir yaşam '
            'biçimiydi.\n\n'
            'Yıllar geçti, bölge değişti. Büyük bir havalimanı inşa edildi. İnşaat sürerken '
            'o tanıdık manzara yavaş yavaş dönüştü. Kulakçayır Gölü de bu dönüşümün bir parçası '
            'oldu — bugün o gölün bulunduğu yerde havalimanının pistleri uzanıyor. Uçaklar her '
            'birkaç dakikada bir o noktanın üzerinden geçiyor.\n\n'
            'Bazen insanlar havalimanının ne kadar büyük ve modern olduğunu anlatıyor. Haklılar. '
            'Gerçekten etkileyici bir yapı. Ama ben aynı zamanda içimde o sabah sislerini, '
            'mandaların ağır adımlarını, gölün yüzeyindeki yansımaları taşıyorum. '
            'Şehirler büyür, yerler değişir. Göl gitti ama hatırası gitmedi. Ben taşıyorum onu.'
        ),
        'location_lat': '41.273000',
        'location_lng': '28.718000',
        'location_name': 'Kulakçayır, Tayakadın (şimdiki İstanbul Havalimanı)',
        'region': 'Istanbul',
        'time_type': Story.TIME_RANGE,
        'year_start': 1990,
        'year_end': 2015,
        'tags': ['nostalgia', 'neighborhood', 'daily-life', 'history'],
        'image_url': None,
    },
    {
        'title': 'Yeniköy\'den Giden Sesler',
        'narrative': (
            'Arnavutköy\'ün Yeniköy mahallesinde doğdum. Karadeniz\'e yakın bir köydü. Evimizin '
            'önünden geçen toprak yol, aşağıda denize inerdi. Komşularımız aynı ailelerin '
            'nesilleriydi — dedeler ve torunlar aynı bahçelerde oturur, aynı tarlalarda çalışırdı. '
            'Sabahları horoz sesleriyle, geceleri de ağaçların rüzgârıyla uyurdum.\n\n'
            'Lise yıllarımda İstanbul\'un bu köşesi değişmeye başladı. Büyük bir havalimanı '
            'inşa edilecekti. İnşaat ilerledikçe etraf da değişti; tanıdık sesler, kokular, '
            'manzaralar yavaş yavaş dönüştü. Komşular şehrin farklı semtlerine yerleşti. '
            'Hayat herkesi farklı yönlere taşıdı. Benim yolum da üniversite için İstanbul\'a çıktı.\n\n'
            'Üniversite bitti, iş buldum, hayat devam etti. Ama her seyahatte İstanbul Havalimanı\'nı '
            'kullandığımda — her iniş ve kalkışta — pencereden o araziye bakarım. Bir zamanlar '
            'ev dediğim yeri hatırlamaya çalışırım. Orası artık pist, terminal, ışıklar. '
            'Ama bende hâlâ horoz sesleri ve deniz kokusu var. Yeniköy sadece bende kaldı.'
        ),
        'location_lat': '41.290000',
        'location_lng': '28.700000',
        'location_name': 'Yeniköy, Arnavutköy (İstanbul Havalimanı çevresi)',
        'region': 'Istanbul',
        'time_type': Story.TIME_RANGE,
        'year_start': 2000,
        'year_end': 2018,
        'tags': ['childhood', 'nostalgia', 'neighborhood', 'history'],
        'image_url': None,
    },
    {
        'title': '29 Ekim 2018: İlk İniş',
        'narrative': (
            'Cumhuriyet\'in 95. yıl dönümünde İstanbul Havalimanı törenle açıldı. Ben orada değildim '
            'ama o gece televizyon karşısında oturarak canlı yayını izledim. Devasa terminal binası, '
            'ışıklar, uçaklar, konuşmalar… Görüntüler gerçekten etkileyiciydi. Dünyanın en büyük '
            'havalimanlarından biri olacaktı. Modern, büyük, İstanbul\'a yakışır bir yapı.\n\n'
            'Açılış görüntülerini izlerken aklıma çocukluğum geldi. Daha küçükken o bölgeleri '
            'ailemle gezerdik. Ormanlar, kıyılar, küçük köyler… Şimdi o arazinin üzerinde dev bir '
            'terminal yükseliyor, binlerce insan her gün buradan dünyaya açılıyor. Şehirler böyle '
            'büyür: bir neslin tanıdığı manzaranın üzerine bir sonraki neslin hayali inşa edilir.\n\n'
            'İstanbul Havalimanı bugün dünyanın en yoğun havalimanlarından biri. Her kalkışta '
            'şehrin ufkuna bakarım — Boğaz, köprüler, siluet. Ve içimde hem gurur hem de tuhaf '
            'bir hüzün vardır. Büyümek güzeldir. Ama büyürken geride kalan her şeyi de '
            'hatırlamak, insanı insan yapan şeydir.'
        ),
        'location_lat': '41.260800',
        'location_lng': '28.741800',
        'location_name': 'İstanbul Havalimanı (IST)',
        'region': 'Istanbul',
        'time_type': Story.TIME_DATE,
        'date_value': '2018-10-29',
        'tags': ['history', 'nostalgia', 'culture'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Istanbu_Airport_interior.jpg/960px-Istanbu_Airport_interior.jpg',
    },
    {
        'title': 'Atatürk Havalimanı\'na Veda: 6 Nisan 2019',
        'narrative': (
            'Atatürk Havalimanı\'nı son kez kullandığım gün, bunu bilmiyordum. Ocak 2019\'daydı. '
            'Normal bir iş seyahati, normal bir gün. Güvenlikten geçtim, bekleme salonuna oturdum, '
            'kahvemi aldım. Pencereden piste baktım — her zamanki gibi. Yıllar boyunca defalarca '
            'yaptığım şey.\n\n'
            '6 Nisan 2019\'da sabahın dördünde son sefer kalktı. Gündüz on dörtde son uçak indi. '
            'Ve Yeşilköy\'deki o havalimanı — 1924\'te kurulan, yüz yıla yakın İstanbul\'un '
            'kapısı olan o yer — sessizleşti. Haberler çıktı, sosyal medyada veda yazıları yazıldı. '
            'Ben de o gün ofiste oturarak telefona baktım ve birden fark ettim: o ocak gününde '
            'uçarken, sanki havalimanıyla vedalaşmak için özel bir andaymış gibi, pencereden '
            'piste bakmanın ne anlama geldiğini bilmiyordum.\n\n'
            'Şimdi Atatürk Havalimanı boş duruyor. Pisler hâlâ var ama üzerinde uçak yok. '
            'Terminaller boş. Onlarca yıl kalabalık olan o koridorlar şimdi sessiz. Ve ben '
            'her seyahat öncesinde yeni havalimanına giderken, aklımın bir köşesinde hep '
            'Yeşilköy\'deki o eski bekleme salonu, o eski kahve kokusu var. Bazı vedalar '
            'söylenmeden olur. En ağır olanlar bunlardır.'
        ),
        'location_lat': '40.976100',
        'location_lng': '28.814600',
        'location_name': 'Atatürk Havalimanı, Yeşilköy',
        'region': 'Istanbul',
        'time_type': Story.TIME_DATE,
        'date_value': '2019-04-06',
        'tags': ['nostalgia', 'history', 'daily-life'],
        'image_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Ataturk_International_Airport_inside.JPG/960px-Ataturk_International_Airport_inside.JPG',
    },
]

# Story-specific comments keyed by title.
# _seed_interactions picks from this list instead of the generic pool.
STORY_COMMENTS = {
    'Büyükada\'ya İlk Vapurla': [
        'Biz de her yaz Büyükada\'ya giderdik, aynı vapurla. Okurken gözlerim doldu.',
        'Martıların peşimizden uçtuğunu ben de çok iyi hatırlıyorum, ne güzel bir anı.',
        'The ferry to the islands is still one of my favourite things about Istanbul.',
        'O vapur güvertesi ve deniz rüzgârı — tam olarak tarif ettiğiniz gibi hissettiriyordu.',
    ],
    'Kadıköy Pazarında Büyükannem': [
        'Büyükannem de aynı şekilde domates sıkardı. Bu yazı beni çok duygulandırdı.',
        'Kadıköy pazarı hâlâ aynı ama siz haklısınız, o insanlar değişti.',
        'Some memories live in smells and textures, not photographs. This is one of them.',
        'O pazar sabahlarını ve simit molalarını okuyunca içim sıkıştı.',
    ],
    'Haydarpaşa\'da Son Tren': [
        'Haydarpaşa\'yı çok özlüyorum. O gara girince insan başka türlü hissederdi.',
        'I remember walking through Haydarpaşa for the last time — surreal feeling.',
        'Binaların kapandığında insanın içinde de bir şeylerin kapandığını çok iyi anlattınız.',
        'Restore edildikten sonra ne olacağını hep merak ediyorum. Ruhu kalır mı acaba?',
    ],
    'Ortaköy\'de Kumpir ve Boğaz': [
        'Ortaköy kumpiri gerçekten başka bir şey. Üniversite yıllarımı hatırlattı.',
        'Those Ortaköy days with friends — I think about them more than I expected to.',
        'Tam benim de yaşadığım şey. O belirsizlik bile güzeldi aslında.',
        'Boğaz\'a bakıp her şeyin geçici ama güzel olduğunu hissetmek — bunu çok iyi anlattınız.',
    ],
    'Moda\'da Sonbahar Yürüyüşleri': [
        'Zor dönemlerde Moda sahilini ben de çok dolaştım. Sizi çok iyi anlıyorum.',
        'Moda has this quiet that nowhere else in Istanbul has. You described it perfectly.',
        'Durabilmeyi öğrenmek en zor şeylerden biri. Teşekkürler bu yazı için.',
        'Kız Kulesi\'nin o saatlerde nasıl göründüğünü okuyunca gözümde canlandı.',
    ],
    'Karaköy\'de Sabah, Vapur Beklerken': [
        'Babamı beklerken aynı duyguyu ben de yaşadım. O büyük eller hiç unutulmuyor.',
        'Karaköy o zamanlardan beri çok değişti ama iskele hâlâ aynı hissi veriyor.',
        'This is such a tender memory. Thank you for sharing it.',
        '"Babam az sonra gelecek" hissi — bunu okuyunca duraksadım. Çok güçlü.',
    ],
    'Balat Sokaklarında Kaybolmak': [
        'Balat\'ı ilk keşfettiğimde ben de tam böyle hissettim. Farklı bir İstanbul.',
        'The open door of that church — I think I know exactly which one you mean.',
        'Tarihin en iyi müzesi bazen açık bir kapıdır. Çok güzel söylediniz.',
        'O Rum kahvaltı yeri hâlâ açık mı acaba? Gitmek istiyorum.',
    ],
    'Boğaz Vapurundan Her Sabah': [
        'Ben de aynı hattı kullandım yıllarca. O 15 dakika gerçekten başkaydı.',
        'The Bosphorus crossing never got old for me either. Miss it every day.',
        'Şehrin sizi yavaşlattığı o an — bunu bu kadar güzel ifade edeceğinizi bilemezdim.',
        'İşten ayrıldıktan sonra en çok vapuru özlemek çok gerçekçi. Aynısını yaşadım.',
    ],
    'The First Time I Saw Istanbul': [
        'I had the exact same experience arriving from a small town. Never got used to it either.',
        'Galata Köprüsü\'nden ilk kez geçmek gerçekten unutulmaz. Sizi çok iyi anlıyorum.',
        'Istanbul finds a way to become home even when you didn\'t plan it. Beautiful.',
        'That moment of pressing your face to the tram window — I did the exact same thing.',
    ],
    'Üsküdar\'da Bir Mahalle Fırını': [
        'Bizim mahallemizde de böyle bir fırın vardı. Artık yok. Çok tanıdık geldi.',
        'The smell of a neighbourhood bakery in the morning is irreplaceable.',
        'İnsanlarla birlikte yerlerin de gittiğini çok iyi anlattınız.',
        'O poğaça hediyesi — fırıncı amcalar böyle iyiydi. Şimdi nerede böylesi?',
    ],
    'Ankara\'da Öğrenci Olmak: Kızılay Sokakları': [
        'Kızılay o kafeleri ben de çok iyi hatırlıyorum. Hepimizin sınav kafesi vardı.',
        'Ankara grows on you in the strangest, most stubborn way. Exactly as you described.',
        'O buğulu camlar ve çay kokusu — gözümde canlandı, teşekkürler.',
        'Rüyada yine öğrenciymiş gibi olmak — bunu çok iyi anlıyorum.',
    ],
    'İzmir Kordon\'u\'nda Akşam Yürüyüşleri': [
        'İzmirliyim, Kordon benim için de aynı anlama geliyor. Teşekkürler.',
        'That image of being both the child and the adult at the same shore — perfect.',
        'Kordon akşamları gerçekten eşsiz. Her dönüşümde mutlaka bir tur atarım.',
        'Taş atma ve dondurma — çocukluğun en saf hali bu.',
    ],
    'Kapadokya\'da Şafak: Balon Sesi': [
        'Aynı sabahı ben de yaşadım. O sessizlik gerçekten başka bir şey.',
        'Cappadocia at dawn with the balloons is one of those sights you never forget.',
        'Planlanmamış anlar her zaman en güzel olanlar. Çok katılıyorum.',
        'O alev sesini rüzgârla dinlemek — tam olarak tarif ettiğiniz gibiydi.',
    ],
    'Gaziantep\'te Büyükannemin Baklavası': [
        'Büyükannem de baklava yapardı. Bu yazıyı okurken yanındaymışım gibi hissettim.',
        'Gaziantep baklava is world-famous but this story made it personal. Beautiful.',
        '"Acelenin olmayacak" — bu cümleyi okuyunca duraksadım. Ne derin bir öğüt.',
        'Büyükanne mutfakları dünyanın en güvenli yerleri. Sizi çok iyi anlıyorum.',
    ],
    'Eskişehir\'de Porsuk Kıyısında Öğrencilik': [
        'Eskişehir\'de okudum, Porsuk kıyısındaki o kafeler hep aklımda.',
        'Some cities raise you without you noticing. Eskişehir was that for me too.',
        'O buğulu camlar ve çay kokusu — tam olarak hatırladığım gibi.',
        'Yıllar sonra aynı köprüde durmak ve değişimi fark etmek — çok tanıdık bir his.',
    ],
    'Antalya Kaleiçi\'nde Kaybolmak': [
        '"Şehir değişti ama liman hep aynı kaldı" — bu cümleyi not aldım.',
        'Kaleiçi has that quality of pulling you in when you least expect it.',
        'En güzel keşifler plansız yapılanlar oluyor. Çok katılıyorum.',
        'O yaşlı balıkçı ve o cümle — bu hikayenin en güzel kısmı.',
    ],
    'Diyarbakır Surlarının Gölgesinde Büyümek': [
        'Diyarbakır surlarını ziyaret etmiştim, ama içinde büyümek başka bir şey.',
        'UNESCO listed it, but you were right — it was always a heritage for you.',
        'Kişisel miras hiçbir unvanla anlatılamaz. Çok güzel bir bakış açısı.',
        'O taşların arasındaki yarıklara bakan çocuk gözü — okurken çok duygulandım.',
    ],
    'Kulakçayır Gölü: Pistin Altındaki Anılar': [
        'Böyle bir gölün var olduğunu bilmiyordum. Okuyunca gözlerim doldu.',
        'Cities change and we forget what was there before. Thank you for remembering.',
        'O sabah sislerini ve manda seslerini okurken kendimi orada hissettim.',
        'Göl gitti ama bu yazı sayesinde artık o da bir yerde yaşıyor.',
    ],
    'Yeniköy\'den Giden Sesler': [
        'Hayat bizi farklı yönlere taşısa da ilk evler hiç gitmez içimizden.',
        'Every flight I take from that airport, I now think about what was there before.',
        'Horoz sesleri ve deniz kokusu — bu iki şey birlikte çok güçlü bir his uyandırdı.',
        'Pencereden köyü aramak ama bulamak — bu sahne çok etkileyici.',
    ],
    '29 Ekim 2018: İlk İniş': [
        'O açılış gecesini ben de izledim. Sizi okuyunca farklı düşündüm bu sefer.',
        'Growth and memory can coexist — you expressed this beautifully.',
        'Büyümek güzel ama geride kalanları hatırlamak da insanı insan yapan şey.',
        'Gurur ve hüzünün aynı anda yaşanabileceğini çok iyi anlattınız.',
    ],
    'Atatürk Havalimanı\'na Veda: 6 Nisan 2019': [
        'Atatürk Havalimanı\'nı çok özlüyorum. O koridorlar başkaydı.',
        'I flew from Atatürk hundreds of times. Didn\'t realise until it was gone.',
        'Söylenmeden olan vedalar gerçekten en ağır olanlar. Çok doğru.',
        'O kahve kokusunu ben de hatırlıyorum. Bazı şeyler unutulmuyor.',
    ],
}
