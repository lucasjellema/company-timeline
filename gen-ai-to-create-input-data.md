# Prompt to make Gen AI generate CSV data to import into Story

## IT Tech Copany History
Generate historical records for these large IT companies: Apple, Microsoft, Oracle, IBM, Google. Generate for each company multiple records for events (such as important product launches , acquisitions) and periods such as the reign of a CEO and the lifetime of a product.  

Create 50 records; 25 for singular events and 25 for periods with a duration of months or years.


## World War II history

Generate historical records for World War II. Three theaters: Europe, Far East, Others (Africa, iddle East and elsewere). ultiple fronts in each theater. Events include invasions, battles, declarations, surrender.


Create 50 records; 25 for singular events and 25 for periods with a duration of months or years.


## Generic instruction:

Desired format: a csv document with records that each describe an event - either a singular, one day event or an event that lasts a period of months or years. 

if the value of a csv field contains a comma, place the field value between "".
The records have these fields:

start,end,title,description,type,level0,level1,level2,lattitude,longitude

start: timestamp of singular event or start date of event period; format: yyyy or yyyy-mm or yyyy-mm-dd



end: timestamp  of end date of event period; format: yyyy or yyyy-mm or yyyy-mm-dd (empty for singular events)



title: short label for event



description: long text with details about the event



type:  in each CSV document, depending on the context, there is a small number of event types or categories; these are used to assign colors to all events of the same type when visualizing the events in a "story canvas" (examples: birth, death, project, product release, battle, reign, wedding, education)



level0: events are grouped in parallel but somewhat distinct groups (such as programs, fronts, families); field level0 is to indicate the highest level group an event is part of



level1: the group is subdivided into finer grained parallel clusters, such as projects within programs, arenas with in fronts, branches within family; level1 optionally indicates this cluster for an event



level2: an even more finer grained subdivision - such as stage within project within program, battle in arena in front, nuclear family within branch within family; level2 indicates this lowest level of subdivision



lattitude,longitude:an event can optionally be associated with a geolocation; if that is the case, these fields specify the location



Note: level1 and level2 are optional. For every level0 value used, there should be at least one record with that level0 value without a level1 and level2 value (to create the collapsible.expandable parent). For every level1 value, there should be at least one record with that level1 value without a level2 value (to create the collapsible.expandable parent). 




example records:



```



start,end,title,description,type,level0,level1,level2,lattitude,longitude



2022-01,2024-12,Vision 2024,Strategic roadmap for company growth. High level objectives for the next two years.,project,company,strategy,global,,



2023-03,2023-05,Q1 Release,Core platform stabilization and features. Includes performance improvements and security patches.,release,company,platform,core,,



2023-06,2023-08,Summer Sprint,Performance optimization phase targeting DB queries and frontend bundle size.,sprint,company,platform,ops,,



```



    