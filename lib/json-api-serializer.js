'use strict';

const _ = require('lodash');
const jas = require('jsonapi-serializer');
const Promise = require('bluebird');

const Serializer = jas.Serializer;
const Deserializer = jas.Deserializer;

function _baseSerializer(type, fieldNames, records) {
    let attributes = _.without(fieldNames, 'id');
    let serializer = new Serializer(type, { attributes });
    return serializer.serialize(records);
}

function _baseDeserializer(data) {
    return new Promise((resolve, reject) => {
        let deserializer = new Deserializer({ keyForAttribute: 'camelCase' });
        deserializer.deserialize(data, (error, value) => {
            if(error) return reject(error);
            return resolve(value);
        });
    });
}

module.exports.serializeForUpdate = function(type, fieldNames, records) {
    
    let attributes = _.without(fieldNames, 'id');
    
    let s = new Serializer(type, { 
        attributes, 
        pluralizeType: false,
        keyForAttribute: 'camelCase' 
    });
    
    return s.serialize(records);
}

module.exports.baseSerializer = function(type, fieldNames, records) {
    return _baseSerializer(type, fieldNames, records);
}

module.exports.apexTestQueueItem = function(fieldNames, records) {
    return _baseSerializer('apex-test-queue-item', fieldNames, records);
}

module.exports.apexTestResult = function(fieldNames, records) {
    return _baseSerializer('apex-test-result', fieldNames, records);
}

module.exports.asyncApexJob = function(fieldNames, records) {
    return _baseSerializer('async-apex-job', fieldNames, records);
}

module.exports.apexLog = function(fieldNames, records) {
    return _baseSerializer('apex-log', fieldNames, records);
}

module.exports.traceFlag = function(fieldNames, records) {
    return _baseSerializer('trace-flag', fieldNames, records);
}

module.exports.debugLevel = function(fieldNames, records) {
    return _baseSerializer('debug-level', fieldNames, records);
}

module.exports.apexTestRunResult = function(fieldNames, records) {
    return _baseSerializer('apex-test-run-result', fieldNames, records);
}

module.exports.apexClass = function(fieldNames, records) {
    return _baseSerializer('class', fieldNames, records);
}

module.exports.deserializeAsync = function(data) {
    return _baseDeserializer(data);
}

module.exports.sobjectDescribe = function() {

    let sobjectName = 'Push_Topic_Queue__c';
    //let mainFieldNames = _.keys(sobjectDescription);
    let included = [];
    sobjectDescription.relationships = {};

    if(sobjectDescription.fields.length > 0) {
        
        let fieldDescriptionFieldNames = _.keys(sobjectDescription.fields[0]);

        //Give each field description a unique id that associates it with the given sobject.
        sobjectDescription.fields.forEach(field => {
            field.id = `${sobjectName}:${field.name}`;
        });

        //Create a json api doc for all of the included fields in the main sobject description.
        let fieldDescriptionDoc = _baseSerializer('field-describe', fieldDescriptionFieldNames, sobjectDescription.fields);

        //Add those to the included array so that they can be "side-loaded" on our payload.
        fieldDescriptionDoc.data.forEach(field => included.push(field));

        sobjectDescription.relationships.fields = {};

        sobjectDescription.relationships.fields.data = sobjectDescription.fields.map(field => {
            return { type: 'field-description', id: field.id };
        });

        delete sobjectDescription.fields;
    }

    let data = [{
        type: 'sobject-describe',
        id: sobjectName,
        attributes: sobjectDescription
    }];

    let final = { data, included };
    console.log(final.data[0].attributes);
}

const sobjectDescription = {"actionOverrides":[],"activateable":false,"childRelationships":[{"cascadeDelete":true,"childSObject":"AttachedContentDocument","deprecatedAndHidden":false,"field":"LinkedEntityId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"AttachedContentDocuments","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"Attachment","deprecatedAndHidden":false,"field":"ParentId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"Attachments","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"CollaborationGroupRecord","deprecatedAndHidden":false,"field":"RecordId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"RecordAssociatedGroups","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"CombinedAttachment","deprecatedAndHidden":false,"field":"ParentId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"CombinedAttachments","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"ContentDistribution","deprecatedAndHidden":false,"field":"RelatedRecordId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":null,"restrictedDelete":false},{"cascadeDelete":true,"childSObject":"ContentDocumentLink","deprecatedAndHidden":false,"field":"LinkedEntityId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"ContentDocumentLinks","restrictedDelete":false},{"cascadeDelete":false,"childSObject":"ContentVersion","deprecatedAndHidden":false,"field":"FirstPublishLocationId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":null,"restrictedDelete":false},{"cascadeDelete":true,"childSObject":"DuplicateRecordItem","deprecatedAndHidden":false,"field":"RecordId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"DuplicateRecordItems","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"EntitySubscription","deprecatedAndHidden":false,"field":"ParentId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"FeedSubscriptionsForEntity","restrictedDelete":false},{"cascadeDelete":false,"childSObject":"FeedComment","deprecatedAndHidden":false,"field":"ParentId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":null,"restrictedDelete":false},{"cascadeDelete":true,"childSObject":"FeedItem","deprecatedAndHidden":false,"field":"ParentId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":null,"restrictedDelete":false},{"cascadeDelete":false,"childSObject":"NetworkActivityAudit","deprecatedAndHidden":false,"field":"ParentEntityId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"ParentEntities","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"Note","deprecatedAndHidden":false,"field":"ParentId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"Notes","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"NoteAndAttachment","deprecatedAndHidden":false,"field":"ParentId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"NotesAndAttachments","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"ProcessInstance","deprecatedAndHidden":false,"field":"TargetObjectId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"ProcessInstances","restrictedDelete":false},{"cascadeDelete":false,"childSObject":"ProcessInstanceHistory","deprecatedAndHidden":false,"field":"TargetObjectId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"ProcessSteps","restrictedDelete":false},{"cascadeDelete":true,"childSObject":"TopicAssignment","deprecatedAndHidden":false,"field":"EntityId","junctionIdListNames":[],"junctionReferenceTo":[],"relationshipName":"TopicAssignments","restrictedDelete":false}],"compactLayoutable":true,"createable":true,"custom":true,"customSetting":false,"deletable":true,"deprecatedAndHidden":false,"feedEnabled":false,"fields":[{"aggregatable":true,"autoNumber":false,"byteLength":18,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":false,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":true,"inlineHelpText":null,"label":"Record ID","length":18,"mask":null,"maskType":null,"name":"Id","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"tns:ID","sortable":true,"type":"id","unique":false,"updateable":false,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":18,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":true,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Owner ID","length":18,"mask":null,"maskType":null,"name":"OwnerId","nameField":false,"namePointing":true,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":["Group","User"],"relationshipName":"Owner","relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"tns:ID","sortable":true,"type":"reference","unique":false,"updateable":true,"writeRequiresMasterRead":false},{"aggregatable":false,"autoNumber":false,"byteLength":0,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":false,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Deleted","length":0,"mask":null,"maskType":null,"name":"IsDeleted","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"xsd:boolean","sortable":true,"type":"boolean","unique":false,"updateable":false,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":true,"byteLength":240,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":false,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":false,"highScaleNumber":false,"htmlFormatted":false,"idLookup":true,"inlineHelpText":null,"label":"Push Topic Queue Name","length":80,"mask":null,"maskType":null,"name":"Name","nameField":true,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"xsd:string","sortable":true,"type":"string","unique":false,"updateable":false,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":9,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":true,"custom":false,"defaultValue":"USD","defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Currency ISO Code","length":3,"mask":null,"maskType":null,"name":"CurrencyIsoCode","nameField":false,"namePointing":false,"nillable":true,"permissionable":false,"picklistValues":[{"active":true,"defaultValue":false,"label":"Canadian Dollar","validFor":null,"value":"CAD"},{"active":true,"defaultValue":false,"label":"New Zealand Dollar","validFor":null,"value":"NZD"},{"active":true,"defaultValue":true,"label":"U.S. Dollar","validFor":null,"value":"USD"}],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":true,"scale":0,"soapType":"xsd:string","sortable":true,"type":"picklist","unique":false,"updateable":true,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":0,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":false,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":false,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Created Date","length":0,"mask":null,"maskType":null,"name":"CreatedDate","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"xsd:dateTime","sortable":true,"type":"datetime","unique":false,"updateable":false,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":18,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":false,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Created By ID","length":18,"mask":null,"maskType":null,"name":"CreatedById","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":["User"],"relationshipName":"CreatedBy","relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"tns:ID","sortable":true,"type":"reference","unique":false,"updateable":false,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":0,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":false,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":false,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Last Modified Date","length":0,"mask":null,"maskType":null,"name":"LastModifiedDate","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"xsd:dateTime","sortable":true,"type":"datetime","unique":false,"updateable":false,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":18,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":false,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"Last Modified By ID","length":18,"mask":null,"maskType":null,"name":"LastModifiedById","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":["User"],"relationshipName":"LastModifiedBy","relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"tns:ID","sortable":true,"type":"reference","unique":false,"updateable":false,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":0,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":false,"custom":false,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":true,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":false,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"System Modstamp","length":0,"mask":null,"maskType":null,"name":"SystemModstamp","nameField":false,"namePointing":false,"nillable":false,"permissionable":false,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"xsd:dateTime","sortable":true,"type":"datetime","unique":false,"updateable":false,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":54,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":true,"custom":true,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":false,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"sObject Record Id","length":18,"mask":null,"maskType":null,"name":"sObject_Record_Id__c","nameField":false,"namePointing":false,"nillable":true,"permissionable":true,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"xsd:string","sortable":true,"type":"string","unique":false,"updateable":true,"writeRequiresMasterRead":false},{"aggregatable":true,"autoNumber":false,"byteLength":150,"calculated":false,"calculatedFormula":null,"cascadeDelete":false,"caseSensitive":false,"compoundFieldName":null,"controllerName":null,"createable":true,"custom":true,"defaultValue":null,"defaultValueFormula":null,"defaultedOnCreate":false,"dependentPicklist":false,"deprecatedAndHidden":false,"digits":0,"displayLocationInDecimal":false,"encrypted":false,"externalId":false,"extraTypeInfo":null,"filterable":true,"filteredLookupInfo":null,"groupable":true,"highScaleNumber":false,"htmlFormatted":false,"idLookup":false,"inlineHelpText":null,"label":"sObject Type","length":50,"mask":null,"maskType":null,"name":"sObject_Type__c","nameField":false,"namePointing":false,"nillable":true,"permissionable":true,"picklistValues":[],"precision":0,"queryByDistance":false,"referenceTargetField":null,"referenceTo":[],"relationshipName":null,"relationshipOrder":null,"restrictedDelete":false,"restrictedPicklist":false,"scale":0,"soapType":"xsd:string","sortable":true,"type":"string","unique":false,"updateable":true,"writeRequiresMasterRead":false}],"hasSubtypes":false,"keyPrefix":"a5p","label":"Push Topic Queue","labelPlural":"Push Topic Queues","layoutable":true,"listviewable":null,"lookupLayoutable":null,"mergeable":false,"mruEnabled":false,"name":"Push_Topic_Queue__c","namedLayoutInfos":[],"networkScopeFieldName":null,"queryable":true,"recordTypeInfos":[{"available":true,"defaultRecordTypeMapping":true,"master":true,"name":"Master","recordTypeId":"012000000000000AAA","urls":{"layout":"/services/data/v38.0/sobjects/Push_Topic_Queue__c/describe/layouts/012000000000000AAA"}}],"replicateable":true,"retrieveable":true,"searchLayoutable":true,"searchable":true,"supportedScopes":[{"label":"All push topic queues","name":"everything"},{"label":"My push topic queues","name":"mine"},{"label":"Queue owned push topic queues","name":"queue_owned"},{"label":"My team's push topic queues","name":"team"},{"label":"User owned push topic queues","name":"user_owned"}],"triggerable":true,"undeletable":true,"updateable":true,"urls":{"compactLayouts":"/services/data/v38.0/sobjects/Push_Topic_Queue__c/describe/compactLayouts","rowTemplate":"/services/data/v38.0/sobjects/Push_Topic_Queue__c/{ID}","approvalLayouts":"/services/data/v38.0/sobjects/Push_Topic_Queue__c/describe/approvalLayouts","uiDetailTemplate":"https://cs22.salesforce.com/{ID}","uiEditTemplate":"https://cs22.salesforce.com/{ID}/e","defaultValues":"/services/data/v38.0/sobjects/Push_Topic_Queue__c/defaultValues?recordTypeId&fields","describe":"/services/data/v38.0/sobjects/Push_Topic_Queue__c/describe","uiNewRecord":"https://cs22.salesforce.com/a5p/e","quickActions":"/services/data/v38.0/sobjects/Push_Topic_Queue__c/quickActions","layouts":"/services/data/v38.0/sobjects/Push_Topic_Queue__c/describe/layouts","sobject":"/services/data/v38.0/sobjects/Push_Topic_Queue__c"}};