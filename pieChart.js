(function() {
    let showingCategoryChart = true;
    let pieChart;

    document.addEventListener('DOMContentLoaded', function () {
        const switchButton = document.getElementById('switchChartButton');
        if (switchButton) {
            switchButton.addEventListener('click', toggleChart); 
        } else {
            console.error('Element with id "switchChartButton" not found.');
        }

        processStoragePie(function(domainTimeMap) {
            const categoryTimeMap = convertToCategories(domainTimeMap);
            showPieChartContainer();
            generatePieChart(categoryTimeMap, 'Time Spent on Categories', 'Switch To Domains');
        });
    });

    function showPieChartContainer() {
        var extraContainer = document.getElementById('extra-container');
        if (extraContainer) {
            extraContainer.style.display = 'block';
        } else {
            console.error('Element with id "extra-container" not found.');
        }
    }

    function toggleChart() {
        processStoragePie(function(domainTimeMap) {
            if (showingCategoryChart) {
                generatePieChart(domainTimeMap, 'Time Spent on Domains', 'Switch To Categories');
            } else {
                const categoryTimeMap = convertToCategories(domainTimeMap);
                generatePieChart(categoryTimeMap, 'Time Spent on Categories', 'Switch To Domains');
            }
            showingCategoryChart = !showingCategoryChart;
        });
    }

    function generatePieChart(dataMap, label, buttonLabel) {
        var ctx = document.getElementById('pieChart').getContext('2d');
        const labels = Object.keys(dataMap);
        const data = Object.values(dataMap);

        if (pieChart instanceof Chart) {
            pieChart.destroy();
        }

        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                    ],
                    borderColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                cutout: '50%',
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });

        // Update the button label
        const switchButton = document.getElementById('switchChartButton');
        if (switchButton) {
            switchButton.textContent = buttonLabel;
        }
    }

    function processStoragePie(callback) {
        chrome.storage.local.get("tabFocusEvents", function (result) {
            const tabFocusEvents = result.tabFocusEvents || {};
            const domainTimeMap = {};
            
            const todaysDate = selectedDate;
            todaysDate.setHours(0, 0, 0, 0);

            for (const domain in tabFocusEvents) {
                if (tabFocusEvents.hasOwnProperty(domain)) {
                    let totalTime = 0;

                    tabFocusEvents[domain].events.forEach(event => {
                        if (event.focusEnd && event.focusStart) {
                            const startTime = new Date(event.focusStart);
                            const endTime = new Date(event.focusEnd);

                            const eventDate = new Date(startTime);
                            eventDate.setHours(0, 0, 0, 0);

                            if (eventDate.getTime() === todaysDate.getTime()) {
                                const elapsed = (endTime - startTime) / 1000;
                                totalTime += elapsed;
                            }
                        }
                    });
                    if (totalTime > 0) {
                        domainTimeMap[domain] = totalTime;
                    }
                }
            }
            callback(domainTimeMap);
        });
    }

    function convertToCategories(domainTimeMap) {
        const categoryTimeMap = {};
        const domainCategoryMap = parseStringToHashmap();
        for (const domain in domainTimeMap) {
            if (domainTimeMap.hasOwnProperty(domain)) {
                const timeSpent = domainTimeMap[domain];
                const category = domainCategoryMap[domain] || 'Other';

                if (categoryTimeMap[category]) {
                    categoryTimeMap[category] += timeSpent;
                } else {
                    categoryTimeMap[category] = timeSpent;
                }
            }
        }
        return categoryTimeMap;
    }

    function parseStringToHashmap() {
        const data = `
        Domain,Category
        facebook.com,Entertainment
        fonts.googleapis.com,Productivity
        google.com,Productivity
        youtube.com,Entertainment.
        twitter.com,News
        googletagmanager.com,Productivity
        instagram.com,Entertainment
        linkedin.com,Productivity
        fonts.gstatic.com,Productivity
        gmpg.org,Productivity
        maps.google.com,Productivity.
        ajax.googleapis.com,Productivity
        youtu.be,Entertainment.
        cdnjs.cloudflare.com,Productivity
        play.google.com,Productivity
        github.com,Productivity
        support.google.com,Productivity.
        plus.google.com,Productivity.
        en.wikipedia.org,Education
        drive.google.com,Productivity
        docs.google.com,Productivity
        wordpress.org,Productivity
        pinterest.com,Productivity.
        goo.gl,Productivity
        developers.google.com,Productivity
        bit.ly,Productivity
        policies.google.com,Productivity
        amazon.com,Productivity
        cloudflare.com,Productivity
        google-analytics.com,Productivity
        vimeo.com,Entertainment
        vk.com,Entertainment
        itunes.apple.com,Productivity.
        secure.gravatar.com,Productivity
        creativecommons.org,Education
        tiktok.com,Entertainment
        medium.com,Education
        apps.apple.com,Productivity
        open.spotify.com,Entertainment
        lh3.googleusercontent.com,Other
        storage.googleapis.com,Productivity
        gstatic.com,Productivity
        player.vimeo.com,Entertainment
        sites.google.com,Productivity.
        ec.europa.eu,News
        cdn.jsdelivr.net,Productivity
        accounts.google.com,Productivity
        t.me,Productivity
        soundcloud.com,Entertainment
        paypal.com,Productivity
        flickr.com,Entertainment
        microsoft.com,Productivity
        chrome.google.com,Productivity
        forms.gle,Productivity.
        code.jquery.com,Productivity
        support.apple.com,Productivity
        tinyurl.com,Productivity
        bbc.co.uk,News
        reddit.com,Entertainment
        nytimes.com,News
        archive.org,Education
        imdb.com,Entertainment
        w3.org,Education
        who.int,News
        theguardian.com,News
        podcasts.apple.com,Entertainment
        apple.com,Productivity
        support.cloudflare.com,Productivity
        mail.google.com,Productivity
        arxiv.org,Education
        linktr.ee,Productivity
        forbes.com,News
        x.com,Other
        support.microsoft.com,Productivity.
        meetup.com,Productivity.
        twitch.tv,Entertainment
        amazon.de,Productivity
        dropbox.com,Productivity
        mozilla.org,Productivity
        s3.amazonaws.com,Productivity
        bbc.com,News
        patreon.com,Productivity
        store.steampowered.com,Productivity
        web.archive.org,Productivity.
        gmail.com,Productivity.
        eur-lex.europa.eu,Education
        discord.gg,Productivity
        bing.com,Productivity
        ncbi.nlm.nih.gov,Education
        news.google.com,News
        maps.googleapis.com,Productivity
        analytics.google.com,Productivity
        adobe.com,Productivity.
        ad.doubleclick.net,Productivity
        washingtonpost.com,News
        amzn.to,Productivity
        blog.google,News
        s.w.org,Education
        support.mozilla.org,Support
        wired.com,News
        dx.doi.org,Education
        calendar.google.com,Productivity
        kickstarter.com,Productivity
        api.whatsapp.com,Productivity
        npr.org,News
        wp.me,Productivity
        google.it,Productivity
        tools.google.com,Productivity.
        t.co,Productivity
        canva.com,Productivity
        platform.twitter.com,Productivity
        shopify.com,Productivity
        ebay.com,Productivity
        weforum.org,News
        m.youtube.com,Entertainment
        businessinsider.com,News
        schema.org,Education
        nasa.gov,Education
        opera.com,Productivity.
        tumblr.com,Entertainment
        fb.me,Entertainment.
        bloomberg.com,News
        wa.me,Productivity.
        i.ytimg.com,Productivity.
        techcrunch.com,News
        stripe.com,Productivity
        eventbrite.com,Productivity
        oracle.com,Productivity
        issuu.com,Productivity
        maxcdn.bootstrapcdn.com,Productivity
        last.fm,Entertainment.
        behance.net,Productivity
        slideshare.net,Productivity
        google.de,Productivity
        aws.amazon.com,Productivity
        zazzle.com,Productivity
        buzzfeed.com,Entertainment
        img.youtube.com,Entertainment
        lulu.com,Productivity
        g.page,Productivity
        ibm.com,Productivity
        time.com,News
        shorturl.at,Productivity
        ko-fi.com,Productivity
        g.co,Productivity
        google.co.uk,Productivity.
        sciencedirect.com,Education
        gov.uk,'Government'
        ted.com,Education
        myaccount.google.com,Productivity
        change.org,Productivity
        amazon.co.uk,Productivity
        transparencyreport.google.com,Productivity
        reuters.com,News
        cloud.google.com,Productivity
        theatlantic.com,News
        commons.wikimedia.org,Education
        docs.microsoft.com,Productivity.
        greenpeace.org,News
        etsy.com,Productivity
        myspace.com,Entertainment
        buymeacoffee.com,Productivity
        strava.com,Productivity
        cdc.gov,News
        quora.com,Education
        developer.mozilla.org,Education
        groups.google.com,Productivity
        theverge.com,Entertainment
        note.com,Productivity
        unsplash.com,Productivity
        cnbc.com,News
        netflix.com,Entertainment
        search.google.com,Productivity
        blogger.com,Productivity.
        statista.com,Education
        a.co,Productivity
        youtube-nocookie.com,Entertainment
        mailchimp.com,Productivity
        nature.com,Education
        ads.google.com,Productivity
        wordpress.com,Productivity
        de.wikipedia.org,Education
        mashable.com,News
        m.facebook.com,Entertainment
        telegraph.co.uk,News
        paypal.me,Productivity
        researchgate.net,Education
        venmo.com,Productivity
        translate.google.com,Productivity
        google.co.jp,Productivity
        yelp.com,Productivity
        googleadservices.com,Productivity
        wsj.com,News
        cnn.com,News
        dailymail.co.uk,News
        use.fontawesome.com,Productivity
        j.mp,Productivity
        gofundme.com,Productivity
        deezer.com,Entertainment
        fb.watch,Entertainment
        lh5.googleusercontent.com,Productivity
        imgur.com,Entertainment
        slate.com,News
        earth.google.com,Productivity
        trello.com,Productivity
        zoom.us,Productivity
        weibo.com,Entertainment
        unpkg.com,Productivity
        static.wixstatic.com,Productivity
        booking.com,Productivity
        mckinsey.com,Productivity
        whitehouse.gov,News
        code.google.com,Productivity
        calendly.com,Productivity
        about.google,Productivity
        yahoo.com,News
        blog.naver.com,Entertainment
        services.google.com,Productivity
        static.googleusercontent.com,Productivity
        sourceforge.net,Productivity
        openai.com,Education
        un.org,News
        tripadvisor.com,Productivity
        ameblo.jp,Entertainment
        huffingtonpost.com,News
        independent.co.uk,News
        msn.com,News
        i.imgur.com,Entertainment.
        googleads.g.doubleclick.net,Productivity.
        developer.apple.com,Productivity
        blog.hubspot.com,Education
        surveymonkey.com,Productivity
        steamcommunity.com,Entertainment
        godaddy.com,Productivity
        is.gd,Productivity
        discord.com,Productivity
        mailchi.mp,Productivity.
        polyfill.io,Productivity.
        doi.org,Education
        discogs.com,Productivity
        ft.com,News
        usatoday.com,News
        developers.facebook.com,Productivity
        maps.app.goo.gl,Productivity
        pixabay.com,Productivity
        music.youtube.com,Entertainment
        europa.eu,Education
        stackoverflow.com,Education
        pexels.com,Productivity
        whatsapp.com,Productivity
        pbs.org,Education
        finance.yahoo.com,News
        music.apple.com,Entertainment
        salesforce.com,Productivity
        books.google.com,Productivity
        matrix.to,Productivity
        edition.cnn.com,News
        link.springer.com,Education
        upload.wikimedia.org,Education
        moz.com,Education
        walmart.com,Productivity.
        cbsnews.com,News
        blog.youtube,Entertainment
        giphy.com,Entertainment
        www2.deloitte.com,Productivity
        dailymotion.com,Entertainment
        example.com,Other
        economist.com,News
        apnews.com,News.
        de-de.facebook.com,Entertainment
        ftc.gov,Education
        ico.org.uk,Productivity
        forms.office.com,Productivity
        bitly.com,Productivity.
        mn.gov,Government
        upwork.com,Productivity
        goodreads.com,Education
        wix.com,Productivity
        businesswire.com,News
        latimes.com,News
        lh6.googleusercontent.com,Productivity
        zdnet.com,News
        tools.ietf.org,Productivity
        fiverr.com,Productivity
        purdue.edu,Education
        bitbucket.org,Productivity
        foursquare.com,Productivity
        cnet.com,Entertainment
        studio.youtube.com,Productivity
        hubs.ly,Productivity
        fortune.com,News
        huffpost.com,News
        venturebeat.com,News
        poynter.org,News
        programmableweb.com,Education
        br.pinterest.com,Productivity
        hbr.org,Education
        playstation.com,Entertainment
        irs.gov,Productivity
        web.facebook.com,Social
        onlinelibrary.wiley.com,Education
        about.me,Productivity.
        lh4.googleusercontent.com,Productivity
        hubspot.com,Productivity
        www1.nyc.gov,News
        slack.com,Productivity
        spotify.com,Entertainment
        disqus.com,Productivity
        euronews.com,News
        arstechnica.com,News
        pbs.twimg.com,Entertainment
        llvm.org,Education
        adssettings.google.com,Productivity
        heylink.me,Productivity
        developer.android.com,Education
        abc.net.au,News
        lit.link,Productivity
        nypost.com,News
        indeed.com,Productivity
        iana.org,Education
        airbnb.com,Productivity
        raw.githubusercontent.com,Productivity.
        iso.org,Productivity
        rtve.es,News
        learn.microsoft.com,Education
        cutt.ly,Productivity
        newyorker.com,News
        prnewswire.com,News
        aboutads.info,Information
        techrepublic.com,Education
        dribbble.com,Entertainment
        gnu.org,Productivity
        developer.chrome.com,Productivity
        thingiverse.com,Productivity.
        help.instagram.com,Education
        sxsw.com,Entertainment
        unicef.org,Education
        gist.github.com,Productivity
        mixi.jp,Entertainment
        streamelements.com,Productivity
        openstreetmap.org,Productivity
        investopedia.com,Education.
        takeout.google.com,Productivity
        itunes.com,Productivity.
        cdn.shopify.com,Productivity.
        evernote.com,Productivity
        tandfonline.com,Education
        thenextweb.com,News
        notion.so,Productivity
        gitlab.com,Productivity
        lifehacker.com,Productivity
        eepurl.com,Productivity
        abcnews.go.com,News
        gog.com,Productivity
        billboard.com,Entertainment
        nbcnews.com,News
        myactivity.google.com,Productivity
        newsweek.com,News
        anchor.fm,Entertainment
        br.de,News
        500px.com,Entertainment
        searchengineland.com,News
        es.wikipedia.org,Education
        samsung.com,Productivity
        res.cloudinary.com,Productivity
        gamasutra.com,Education
        britannica.com,Education
        groups.yahoo.com,Productivity
        google.fr,Productivity
        census.gov,News
        codepen.io,Productivity
        khanacademy.org,Education
        news.yahoo.com,News
        meti.go.jp,News
        theconversation.com,News
        unrealengine.com,Productivity
        epa.gov,Education
        mc.yandex.ru,Productivity
        nicovideo.jp,Entertainment
        geo.itunes.apple.com,Productivity
        kantar.com,Productivity
        loc.gov,Education
        zoho.com,Productivity
        i0.wp.com,Productivity
        gamespot.com,Entertainment.
        fb.com,Entertainment.
        blog.livedoor.jp,News
        timeanddate.com,Productivity
        goo.gle,Productivity
        php.net,Education
        shutterstock.com,Productivity
        pagead2.googlesyndication.com,Productivity
        justice.gov,News
        windows.microsoft.com,Productivity
        ipfs.io,Productivity
        blacklivesmatter.com,News
        amazon.co.jp,Productivity
        qz.com,News
        npmjs.com,Productivity.
        usnews.com,News
        brendangregg.com,Productivity.
        crunchbase.com,Productivity.
        get.adobe.com,Productivity
        igg.me,Productivity
        pubmed.ncbi.nlm.nih.gov,Education
        vox.com,News
        connect.facebook.net,Productivity
        thetimes.co.uk,News
        trustpilot.com,Productivity
        media.ccc.de,Education
        google.nl,Productivity
        automattic.com,Productivity
        brainstormforce.com,Productivity.
        w3c.github.io,Education
        scmp.com,News
        udemy.com,Education.
        w3schools.com,Education
        zendesk.com,Productivity
        scholar.google.com,Education
        skype.com,Productivity
        podcasts.google.com,Entertainment
        wikihow.com,Education
        mobile.twitter.com,Entertainment
        us02web.zoom.us,Productivity
        line.me,Productivity
        penguin.co.uk,Education
        pf.kakao.com,Entertainment
        acm.org,Education
        ru.wikipedia.org,Education
        heise.de,News
        figma.com,Productivity
        marketingplatform.google.com,Productivity.
        google.ca,Productivity
        dol.gov,Education
        business.facebook.com,Productivity.
        entrepreneur.com,Productivity
        journals.sagepub.com,Education
        rebrand.ly,Productivity
        worldbank.org,Education
        ikea.com,Productivity
        feedly.com,Productivity
        addons.mozilla.org,Productivity
        uber.com,Productivity
        foxnews.com,News
        amazon.fr,Productivity
        barnesandnoble.com,Productivity
        marketwatch.com,News
        jetbrains.com,Productivity
        pulitzercenter.org,News
        money.cnn.com,News
        vice.com,Entertainment
        examiner.com,News
        msdn.microsoft.com,Education
        telegram.org,Productivity
        analog.com,Productivity
        privacy.microsoft.com,Productivity
        yalebooks.co.uk,Education
        zillow.com,Productivity
        coursera.org,Education
        academic.oup.com,Education
        newsinitiative.withgoogle.com,News
        lemonde.fr,News
        go.microsoft.com,Productivity
        2.bp.blogspot.com,Entertainment
        gartner.com,Productivity
        variety.com,Entertainment
        mixcloud.com,Entertainment
        searchenginejournal.com,News
        airtable.com,Productivity.
        popsci.com,News
        yandex.com,Productivity
        taplink.cc,Productivity
        eff.org,News
        fda.gov,News
        workspace.google.com,Productivity
        smarturl.it,Productivity
        podcasters.spotify.com,Productivity
        owasp.org,Education.
        cambridge.org,Education
        fastcompany.com,News
        scribd.com,Education
        squareup.com,Productivity
        xing.com,Productivity.
        politico.com,News.
        imagedelivery.net,Productivity
        wsws.org,News
        google.es,Productivity
        safety.google,Productivity
        spiegel.de,News
        post.ch,Productivity
        help.twitter.com,Productivity
        semrush.com,Productivity
        thehill.com,News
        rtbf.be,News
        missingkids.org,Education.
        inc.com,News
        google.com.au,Productivity
        clickfunnels.com,Productivity
        telegram.me,Productivity
        px.ads.linkedin.com,Productivity
        pwc.com,Productivity
        help.github.com,Education
        spreaker.com,Entertainment
        bcn.cl,Productivity
        axios.com,News.
        theglobeandmail.com,News
        israelnationalnews.com,News
        firebase.google.com,Productivity
        azure.microsoft.com,Productivity
        amazon.it,Productivity.
        northjersey.com,News
        apache.org,Productivity
        datacommons.org,Education
        techradar.com,News
        i.pinimg.com,Productivity.
        hhs.gov,News
        cve.mitre.org,Education
        cdbaby.com,Productivity
        fonts.google.com,Productivity
        gizmodo.com,Entertainment
        missingkids.com,Education
        ok.ru,Entertainment
        sustainability.google,Productivity
        istockphoto.com,Productivity
        lifewire.com,Productivity
        youtube.googleblog.com,News
        target.com,Productivity
        mssg.me,Productivity.
        fr.wikipedia.org,Education
        hackerone.com,Productivity
        cdn.who.int,News
        ed.ted.com,Education
        getpocket.com,Productivity
        cdtfa.ca.gov,Productivity
        static.cloudflareinsights.com,Productivity
        gravatar.com,Productivity
        asana.com,Productivity
        linkr.bio,Productivity
        history.com,Education
        r.gnavi.co.jp,Entertainment
        oecd.org,Education
        oreilly.com,Education
        google.ru,Productivity
        blog.twitter.com,News
        psychologytoday.com,Education
        yandex.ru,News
        europarl.europa.eu,News
        vpro.nl,News
        deviantart.com,Entertainment.
        pewresearch.org,News
        sec.gov,Productivity
        smithsonianmag.com,Education
        dur.ac.uk,Education
        hootsuite.com,Productivity
        uk.linkedin.com,Productivity
        zapier.com,Productivity
        nam.edu,Education
        ahrefs.com,Productivity.
        discordapp.com,Productivity
        css-tricks.com,Education
        duckduckgo.com,Productivity
        4.bp.blogspot.com,Entertainment
        speakerdeck.com,Education
        journals.plos.org,Education
        youtube-creators.googleblog.com,News
        cisco.com,Productivity.
        nielsen.com,News
        webmasters.googleblog.com,News
        globenewswire.com,News
        tiff.net,Entertainment
        3.bp.blogspot.com,Entertainment
        jigsaw.google.com,Productivity
        xkcd.com,Entertainment
        raiplay.it,Entertainment
        meyerweb.com,Productivity
        photos.google.com,Productivity
        creatoracademy.youtube.com,Education
        kinopoisk.ru,Entertainment
        en.m.wikipedia.org,Education
        accenture.com,Productivity
        nationalgeographic.com,Education
        pubads.g.doubleclick.net,Productivity.
        dl.dropboxusercontent.com,Productivity
        1.bp.blogspot.com,Other
        cbc.ca,News
        chicagotribune.com,News
        thinkgeek.com,Productivity
        buffer.com,Productivity
        knowyourmeme.com,Entertainment
        kstatic.googleusercontent.com,Productivity
        i1.wp.com,Productivity
        bat.bing.com,Productivity
        fao.org,Education
        ngm.nationalgeographic.com,Education
        static1.squarespace.com,Productivity
        nvidia.com,Productivity.
        fitbit.com,Productivity.
        prezi.com,Productivity
        jotform.com,Productivity
        adweek.com,News
        google.qualtrics.com,Productivity
        amazon.es,Productivity
        usps.com,Productivity
        deepl.com,Productivity
        blog.cloudflare.com,News
        pastebin.com,Productivity
        help.pinterest.com,Productivity
        en.gravatar.com,Productivity
        rightwingwatch.org,News
        propublica.org,News
        families.google.com,Productivity
        freepik.com,Productivity
        iubenda.com,Productivity.
        feeds.feedburner.com,Productivity
        docs.oracle.com,Education
        i2.wp.com,Productivity
        ssl.gstatic.com,Productivity
        pinterest.co.uk,Productivity
        fcc.gov,Government
        ifttt.com,Productivity
        state.gov,News
        artstation.com,Entertainment
        phys.org,Education
        merriam-webster.com,Education.
        vaticannews.va,News
        aescripts.com,Productivity
        thinkwithgoogle.com,Education
        extend-wp.com,Productivity
        pcisecuritystandards.org,Productivity
        constantcontact.com,Productivity
        donorbox.org,Productivity.
        online.wsj.com,News
        sciencemag.org,Education
        amazon.ca,Productivity
        public.tableau.com,Productivity.
        buzzfeednews.com,News
        coindesk.com,News
        miro.com,Productivity.
        scientificamerican.com,Education
        tv.youtube.com,Entertainment
        infowars.com,News
        snapchat.com,Entertainment
        science.sciencemag.org,Education
        siteground.com,Productivity
        dw.com,News
        eji.org,Education
        drupal.org,Productivity.
        validator.w3.org,Productivity
        nps.gov,Education
        thegadgetflow.com,Productivity
        kisskissbankbank.com,Productivity
        cs.mun.ca,Education
        woocommerce.com,Productivity
        about.fb.com,News
        klarna.com,Productivity
        opensea.io,Productivity
        starbucks.com,Productivity
        bls.gov,Education.
        mayoclinic.org,Education
        papers.ssrn.com,Education
        mrdoob.com,Entertainment
        flipboard.com,News
        privacyshield.gov,Productivity.
        advancedformintegration.com,Productivity
        law.cornell.edu,Education
        apis.google.com,Productivity
        ffm.to,Productivity
        jquery.com,Productivity
        makeuseof.com,Productivity
        opensource.org,Education
        account.google.com,Productivity
        chat.openai.com,Productivity
        themeforest.net,Productivity.
        nngroup.com,Education
        wipo.int,Education
        aljazeera.com,News
        greenamerica.org,Education
        nist.gov,Education
        cse.google.com,Productivity
        nationalmssociety.org,Education
        english.aljazeera.net,News
        bandsintown.com,Entertainment
        unir.net,News
        speaker.gov,News
        sciencedaily.com,News
        similarweb.com,Productivity
        voanews.com,News
        unicode.org,Education.
        pcmag.com,News
        material.io,Productivity
        commission.europa.eu,News
        economictimes.indiatimes.com,News
        mediafire.com,Productivity
        mdpi.com,Education
        pitchfork.com,Entertainment.
        pay.google.com,Productivity
        ja.wikipedia.org,Education
        gsuite.google.com,Productivity
        toucharcade.com,Entertainment
        ietf.org,Education
        indiegogo.com,Productivity.
        baidu.com,Entertainment
        science.org,Education
        lastpass.com,Productivity
        icann.org,Education
        vogue.com,Entertainment
        getresponse.com,Productivity
        smh.com.au,News
        networkadvertising.org,Productivity
        caniuse.com,Productivity
        neuracache.com,Education
        thegrommet.com,Productivity.
        technologyreview.com,News
        academia.edu,Education
        humanrightsfirst.org,Education
        darden.virginia.edu,Education
        rollingstone.com,Entertainment
        w3techs.com,Education
        lewishowes.com,Education
        barco.com,Productivity
        tableau.com,Productivity
        engadget.com,Entertainment.
        mecd.gob.es,Education
        redcross.org,Productivity
        developer.oracle.com,Education
        bigcommerce.com,Productivity
        orcd.co,Productivity
        miraclegaming.store,Productivity
        wetransfer.com,Productivity
        frontiersin.org,Education
        alibaba.com,Productivity
        alltop.com,News
        chrisharrison.net,Personal
        digg.com,News
        csrc.nist.gov,Education
        rubykaigi.org,Education
        pnas.org,Education
        fool.com,Finance
        hrw.org,News
        patents.google.com,Productivity
        neilpatel.com,Productivity
        brookings.edu,Education
        glitzstorm.com,Entertainment
        wretch.cc,Entertainment
        1drv.ms,Productivity
        brave.com,Productivity
        canada.ca,Government
        ubuntu.com,Productivity.
        prweb.com,News
        bleepingcomputer.com,Productivity.
        universal-music.co.jp,Entertainment
        dl.acm.org,Education
        curia.europa.eu,Education
        congress.gov,News
        digilander.libero.it,Entertainment
        sb.scorecardresearch.com,Productivity
        ifcncodeofprinciples.poynter.org,Education
        web.dev,Education
        enterprisemarketingportal.google,Productivity
        twilio.com,Productivity
        producthunt.com,Productivity
        flaticon.com,Productivity
        dell.com,Productivity
        timesofindia.indiatimes.com,News
        glassdoor.com,Productivity
        startengine.com,Productivity
        kids.youtube.com,Entertainment
        fbi.gov,News
        verizon.com,Productivity.
        smashingmagazine.com,Education.
        volcom.com,Productivity
        stupidhackathon.github.io,Entertainment
        wikipedia.org,Education
        donysterling.co.uk,Entertainment
        donysterling.com,Entertainment.
        gigaom.com,News
        allaboutcookies.org,Education.
        webaim.org,Education.
        bestbuy.com,Productivity
        kiva.org,Education
        popoko.live,Entertainment
        visitlondon.com,Entertainment
        dearmoon.earth,Education.
        cato.org,News
        blogs.wsj.com,News
        maps.secondlife.com,Entertainment
        irishtimes.com,News.
        jsfiddle.net,Productivity
        chat.whatsapp.com,Productivity
        coschedule.com,Productivity
        gumroad.com,Productivity
        activecampaign.com,Productivity
        inyourpocket.com,Travel
        orcid.org,Education
        kinsta.com,Productivity
        cmog.org,Education
        youtubekids.com,Entertainment
        urbandictionary.com,Entertainment
        wam.ae,News
        foreignpolicy.com,News
        l214.com,Education
        codex.wordpress.org,Education
        newscientist.com,News
        healthline.com,Health.
        coinbase.com,Productivity.
        ohchr.org,Education.
        cdata.com,Productivity
        sdgs.un.org,Education
        mp.weixin.qq.com,News
        wikimediafoundation.org,Education
        abuosama.com,Other
        s3-us-west-2.amazonaws.com,Productivity
        news.bbc.co.uk,News
        webmd.com,Health
        seekingalpha.com,News
        wellbeing.google,Productivity
        lumecube.com,Productivity
        microformats.org,Education
        yumpu.com,Entertainment
        lnk.to,Productivity
        pubs.acs.org,Education
        thestar.com,News
        picasaweb.google.com,Productivity
        whats-on-netflix.com,Entertainment
        vizaginfo.com,Information
        prototypefund.de,Education
        healthypets.mercola.com,Education
        blockchain.com,Productivity
        ieeexplore.ieee.org,Education.
        today.com,News
        pragmatic-game.com,Entertainment
        ali.pub,Productivity
        python.org,Education
        support.office.com,Productivity
        dianomi.com,Productivity
        nhs.uk,Education
        kirunafestivalen.com,Entertainment
        gov.br,News
        depositfiles.com,Productivity
        idfa.nl,Entertainment
        tn.b4closing.com,Productivity.
        hub.docker.com,Productivity
        obviousarticles.com,Education
        reecase.com,Productivity.
        legislation.gov.uk,Education.
        rfc-editor.org,Education
        techtarget.com,Productivity
        beinternetawesome.withgoogle.com,Education
        grameen-info.org,Education
        artsandculture.google.com,Education
        bridgeloungenola.com,Entertainment
        unibw.de,Education
        nba.com,Entertainment
        google.pl,Productivity.
        app.box.com,Productivity
        bgu.aikomus.com,Education
        bostonglobe.com,News
        nvd.nist.gov,Education
        openhome.cc,Education
        ivermectininstock.com,Productivity
        federalregister.gov,News
        m.me,Productivity
        customercaresupportnumber.com,Productivity
        gettyimages.com,Productivity
        gunbound.web.id,Entertainment
        cometalaux.com,Entertainment
        chromewebstore.google.com,Productivity
        wunderground.com,News
        gositoday.com,Entertainment
        marriott.com,Productivity
        yt.be,Productivity.
        ivycityco.com,Productivity
        bocpainters.com,Productivity.
        technorati.com,News
        lambdasf.org,Education
        opendoorbooks.com,Education
        sinausap.com,News
        instapaper.com,Productivity.
        bestcinemark.com,Entertainment
        jemi.so,Productivity.
        streetfilms.org,Entertainment
        snipfeed.co,Entertainment
        artyfartylife.com,Entertainment
        shophamitusta.com,Productivity
        fossgis.de,Education.
        adwords.google.com,Productivity
        telegra.ph,Productivity.
        jstor.org,Education
        patchstorage.com,Productivity.
        cdn.ampproject.org,Productivity
        html.spec.whatwg.org,Education
        news.microsoft.com,News
        kino.com,Entertainment
        l.facebook.com,Productivity
        gs.statcounter.com,Productivity.
        ti.nutrapia.com,Productivity
        huggingface.co,Productivity
        stage6.divx.com,Entertainment
        rrganursery.com,Productivity
        rdoproject.org,Education
        community.theforeman.org,Community
        citeseerx.ist.psu.edu,Education
        yunxiaochengkj.com,Other
        preview.tinyurl.com,Productivity
        bw9.824989.com,Productivity
        edx.org,Education
        shape.stanford.edu,Education.
        kristelgourden.com,Entertainment
        roxanegay.com,Education
        i.ibb.co,Productivity
        zxaaa.net,Other
        2015.funswiftconf.com,Entertainment.
        coinmarketcap.com,Productivity
        hfdlzg.com,Other
        ethereum.org,Education.
        wattpad.com,Entertainment
        tomsguide.com,Productivity
        istartedsomething.com,Technology
        2017.jsconf.eu,Education
        polygon.com,Entertainment
        wired.co.uk,News
        buzzsprout.com,Productivity
        performous.org,Entertainment.
        skagmo.com,Other
        flaflo.xyz,Other
        andalucia.org,Travel
        winconsgroup.com,Productivity
        ib.adnxs.com,Productivity.
        madnessmyfamily.com,Entertainment
        digitalocean.com,Productivity
        ma.tt,Productivity
        reviewsiro.com,Productivity
        keoghsflex.com,Productivity
        ups.com,Productivity
        te.webgomme.com,Other
        creationsitewebmaroc.online,Productivity
        xero.com,Productivity
        code.visualstudio.com,Productivity
        podbean.com,Entertainment.
        krebsonsecurity.com,News
        binance.com,Productivity.
        intel.com,Productivity
        growonair.withgoogle.com,Education.
        collaborativejournalism.org,Education
        socialimpact.youtube.com,Entertainment
        helpx.adobe.com,Productivity
        android.com,Productivity
        documentcloud.org,Productivity
        unlimitedarticlesource.com,Education
        acidholic.com,Entertainment
        yiyongsc.com,Other
        ahkrzn.com,Other
        beppegrillo.it,News
        crypto.com,Productivity
        mega.nz,Productivity
        padlet.com,Productivity
        icgiyimkapinda.com,Productivity.
        atlassian.com,Productivity
        islamtics.com,Education
        metoffice.gov.uk,News
        redbubble.com,Productivity
        cxwdm.com,Other
        atlasobscura.com,Entertainment
        audible.com,Entertainment
        logitech.com,Productivity
        insights.sustainability.google,Productivity
        waze.com,Productivity
        outlookindia.com,News
        skillshare.com,Education
        informit.com,Education
        uci.org,Education
        httyb.com,Entertainment
        globalnews.ca,News
        duniabd.com,News
        michigan.gov,Government
        images.google.com,Productivity
        guardian.co.uk,News
        afr.com,News
        chinadaily.com.cn,News
        positivemoney.org,Education
        oag.ca.gov,Information
        cyqiaosen.com,Entertainment
        secure.adnxs.com,Productivity
        nylon.jp,Entertainment
        arkaos.net,Entertainment
        foodshuttle.org,Education
        lnk.bio,Productivity
        pno.824989.com,Entertainment
        nymag.com,News
        muji.net,Productivity
        join.slack.com,Productivity
        fontawesome.com,Productivity
        houzz.com,Productivity.
        gutenberg.org,Education
        contagious.com,Entertainment
        ik.webgomme.com,Other
        threads.net,Productivity
        margaretahaz.com,Entertainment
        bbb.org,Productivity
        urldefense.com,Productivity

        `;

        const lines = data.trim().split('\n');
        const domainCategoryMap = {};

        lines.forEach(line => {
            line = line.trim();
            if (line) {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const domain = parts[0].trim();
                    const category = parts.slice(1).join(',').trim();
                    domainCategoryMap[domain] = category;
                } else {
                    console.warn('Skipping malformed line:', line);
                }
            }
        });

        return domainCategoryMap;
    }
})();
