# Prompt to make Gen AI generate CSV data to import into Story

## IT Tech Company History
Generate historical records for these large IT companies: Apple, Microsoft, Oracle, IBM, Google. Generate for each company multiple records for events (such as important product launches , acquisitions) and periods such as the reign of a CEO and the lifetime of a product.  
Create 50 records; 25 for singular events and 25 for periods with a duration of months or years.
## World War II history
Generate historical records for World War II. Three theaters: Europe, Far East, Others (Africa, iddle East and elsewere). ultiple fronts in each theater. Events include invasions, battles, declarations, surrender.
Create 50 records; 25 for singular events and 25 for periods with a duration of months or years.


## Space History 
Generate historical records for Space explorations. Level 0 groups for USSR / Russia, USA, : Europe, China, Others . For USA for example discern programs Mercury, Gemini, Apollo, Skylab, Space Shuttle, unmanned. Similar for USSR.

Create 80 records; make a mix between singular events and multiple day/month/year programs. 

## Football History 
Generate historical records for some major European football leagues over the period 2005-2026: Premier League, Eredivisie, Bundesliga, Primera Division, Serie A. Include the top 3 clubs from each league. For each club, include events for their trainer/coach and his "reign". For each club, include events for national championship and European cup. Include events for moving into a stadium. Include events for other really important developments (top transfer, major incident, death of a player)  

For each league, include events for national championship when not won by the one of the top 3 clubs. 

Create 100+ records; make a mix between singular, one-moment events and events that last multiple days/months/years. 


## Generic instruction:
Desired format: a csv document with records that each describe an event - either a singular, one day event or an event that lasts a period of months or years. 
if the value of a csv field contains a comma, place the field value between "".
The records have these fields:
start,end,title,description,type,level0,level1,level2,lattitude,longitude,locationName
start: timestamp of singular event or start date of event period; format: yyyy or yyyy-mm or yyyy-mm-dd

end: timestamp  of end date of event period; format: yyyy or yyyy-mm or yyyy-mm-dd (same value for start and end for singular events)

title: short label for event

description: long text with details about the event

type:  in each CSV document, depending on the context, there is a small number of event types or categories; these are used to assign colors to all events of the same type when visualizing the events in a "story canvas" (examples: birth, death, project, product release, battle, reign, wedding, education)

level0: events are grouped in parallel but somewhat distinct groups (such as programs, fronts, families); field level0 is to indicate the highest level group an event is part of

level1: the group is subdivided into finer grained parallel clusters, such as projects within programs, arenas with in fronts, branches within family; level1 optionally indicates this cluster for an event

level2: an even more finer grained subdivision - such as stage within project within program, battle in arena in front, nuclear family within branch within family; level2 indicates this lowest level of subdivision

lattitude,longitude:an event can optionally be associated with a geolocation; if that is the case, these fields specify the location
locationName: if an event is associated with a geolocation, this property can contain the label or displayname for the location.

Note: level1 and level2 are optional. For every level0 value used, there should be at least one record with that level0 value without a level1 and level2 value (to create the collapsible.expandable parent). For every level1 value, there should be at least one record with that level1 value without a level2 value (to create the collapsible.expandable parent). 


example records:

```

start,end,title,description,type,level0,level1,level2,lattitude,longitude,locationName
1975-04-04,1975-04-04,Microsoft Founded,Bill Gates and Paul Allen found Microsoft to develop BASIC for the Altair 8800.,event,Microsoft,Corporate,Founding,35.0844,-106.6504,Albuquerque NM (MITS Headquarters)
1976-04-01,1976-04-01,Apple Founded,Steve Jobs and Steve Wozniak form Apple Computer to sell the Apple I.,event,Apple,Corporate,Founding,37.3230,-122.0322,Los Altos CA (Jobs Garage)
1977-06-16,1977-06-16,Oracle Founded,Larry Ellison and partners found SDL (later Oracle) to build a relational database.,event,Oracle,Corporate,Founding,37.5295,-122.2530,Santa Clara CA (First Office)
1979-06-01,1979-06-01,Oracle v2 Release,The first commercially available SQL-based relational database management system.,product,Oracle,Software,Database,37.5295,-122.2530,Santa Clara CA
2024-11,2026,Ruben Amorim Era,"Manchester United appoint Ruben Amorim to lead a new tactical era for the club.",reign,Premier League,Manchester United,Coaching,53.4631,-2.2913,"Manchester,UK"
2005,2026,Liverpool FC,"The resurgence of the Reds into a global powerhouse under Klopp and the transition to Arne Slot.",club,Premier League,Liverpool,,,
2005-05-25,2005-05-25,Miracle of Istanbul,"Liverpool recover from 3-0 down at half-time to beat AC Milan in the UCL final.",european cup,Premier League,Liverpool,Europe,41.0744,28.7656,"Istanbul, Turkye"
2015-10,2024-05,Jurgen Klopp Era,"A golden era resulting in a Premier League title, a Champions League, and multiple cups.",reign,Premier League,Liverpool,Coaching,53.4308,-2.9608,"Anfield Road"



```

    