const utils = require('../utils');

const trigger = {
  renameColumnTrigger: function(
    logger,
    formatter,
    user,
    tableNameRaw,
    columnNameRaw,
    toRaw
  ) {
    const triggerNameRaw = utils.generateCombinedName(
      logger,
      'autoinc_trg',
      tableNameRaw
    );
    const triggerName = formatter.wrap(triggerNameRaw);
    const sequenceNameRaw = utils.generateCombinedName(
      logger,
      'seq',
      tableNameRaw
    );
    const sequenceName = formatter.wrap(sequenceNameRaw);
    const tableName = formatter.wrap(tableNameRaw);
    const columnName = formatter.wrap(columnNameRaw);
    const to = formatter.wrap(toRaw);
    return (
      `DECLARE ` +
      `PK_NAME VARCHAR(200); ` +
      `IS_AUTOINC NUMBER := 0; ` +
      `BEGIN` +
      `  EXECUTE IMMEDIATE ('ALTER TABLE ${tableName} RENAME COLUMN ${columnName} TO ${to}');` +
      `  SELECT COUNT(*) INTO IS_AUTOINC from "USER_TRIGGERS" where trigger_name = '${triggerNameRaw}';` +
      `  IF (IS_AUTOINC > 0) THEN` +
      `    SELECT cols.column_name INTO PK_NAME` +
      `    FROM all_constraints cons, all_cons_columns cols` +
      `    WHERE cons.constraint_type = 'P'` +
      `    AND cons.constraint_name = cols.constraint_name` +
      `    AND cons.owner = cols.owner` +
      `    AND cons.owner = '${user}'` +
      `    AND cols.table_name = '${tableNameRaw}';` +
      `    IF ('${to}' = PK_NAME) THEN` +
      `      EXECUTE IMMEDIATE ('DROP TRIGGER ${triggerName}');` +
      `      EXECUTE IMMEDIATE ('create or replace trigger ${triggerName}` +
      `      BEFORE INSERT on ${tableName} for each row` +
      `        declare` +
      `        checking number := 1;` +
      `        begin` +
      `          if (:new."${to}" is null) then` +
      `            while checking >= 1 loop` +
      `              select ${sequenceName}.nextval into :new.${to} from dual;` +
      `              select count(${to}) into checking from ${tableName}` +
      `              where ${to} = :new.${to};` +
      `            end loop;` +
      `          end if;` +
      `        end;');` +
      `    end if;` +
      `  end if;` +
      `END;`
    );
  },

  createAutoIncrementTrigger: function(logger, formatter, user, tableNameRaw) {
    const triggerNameRaw = utils.generateCombinedName(
      logger,
      'autoinc_trg',
      tableNameRaw
    );
    const triggerName = formatter.wrap(triggerNameRaw);
    const sequenceNameRaw = utils.generateCombinedName(
      logger,
      'seq',
      tableNameRaw
    );
    const sequenceName = formatter.wrap(sequenceNameRaw);
    const tableName = formatter.wrap(tableNameRaw);
    
    return (
      `DECLARE ` +
      `PK_NAME VARCHAR(200); ` +
      `BEGIN` +
      `  EXECUTE IMMEDIATE ('CREATE SEQUENCE ${sequenceName}');` +
      `  SELECT cols.column_name INTO PK_NAME` +
      `  FROM all_constraints cons, all_cons_columns cols` +
      `  WHERE cons.constraint_type = 'P'` +
      `  AND cons.constraint_name = cols.constraint_name` +
      `  AND cons.owner = cols.owner` +
      `  AND cons.owner = '${user}'` +
      `  AND cols.table_name = '${tableNameRaw}';` +
      `  execute immediate ('create or replace trigger ${triggerName}` +
      `  BEFORE INSERT on ${tableName}` +
      `  for each row` +
      `  declare` +
      `  checking number := 1;` +
      `  begin` +
      `    if (:new."' || PK_NAME || '" is null) then` +
      `      while checking >= 1 loop` +
      `        select ${sequenceName}.nextval into :new."' || PK_NAME || '" from dual;` +
      `        select count("' || PK_NAME || '") into checking from ${tableName}` +
      `        where "' || PK_NAME || '" = :new."' || PK_NAME || '";` +
      `      end loop;` +
      `    end if;` +
      `  end;'); ` +
      `END;`
    );
  },

  renameTableAndAutoIncrementTrigger: function(
    logger,
    formatter,
    user,
    tableNameRaw,
    toRaw
  ) {
    const triggerNameRaw = utils.generateCombinedName(
      logger,
      'autoinc_trg',
      tableNameRaw
    );
    const triggerName =  formatter.wrap(triggerNameRaw);
    const sequenceName = utils.generateCombinedName(
      logger,
      'seq',
      tableNameRaw
    );
    const toTriggerNameRaw = utils.generateCombinedName(
      logger,
      'autoinc_trg',
      toRaw
    );
    const toTriggerName = formatter.wrap(toTriggerNameRaw);
    const toSequenceNameRaw = utils.generateCombinedName(logger, 'seq', toRaw);
    const toSequenceName = formatter.wrap(toSequenceNameRaw);
    const tableName = formatter.wrap(tableNameRaw);
    const to = formatter.wrap(toRaw);
    return (
      `DECLARE ` +
      `PK_NAME VARCHAR(200); ` +
      `IS_AUTOINC NUMBER := 0; ` +
      `BEGIN` +
      `  EXECUTE IMMEDIATE ('RENAME ${tableName} TO ${to}');` +
      `  SELECT COUNT(*) INTO IS_AUTOINC from "USER_TRIGGERS" where trigger_name = '${triggerNameRaw}';` +
      `  IF (IS_AUTOINC > 0) THEN` +
      `    EXECUTE IMMEDIATE ('DROP TRIGGER ${triggerName}');` +
      `    EXECUTE IMMEDIATE ('RENAME ${sequenceName} TO ${toSequenceName}');` +
      `    SELECT cols.column_name INTO PK_NAME` +
      `    FROM all_constraints cons, all_cons_columns cols` +
      `    WHERE cons.constraint_type = 'P'` +
      `    AND cons.constraint_name = cols.constraint_name` +
      `    AND cons.owner = cols.owner` +
      `    AND cons.owner = ${user}` +
      `    AND cols.table_name = '${to}';` +
      `    EXECUTE IMMEDIATE ('create or replace trigger ${toTriggerName}` +
      `    BEFORE INSERT on ${to} for each row` +
      `      declare` +
      `      checking number := 1;` +
      `      begin` +
      `        if (:new."' || PK_NAME || '" is null) then` +
      `          while checking >= 1 loop` +
      `            select ${toSequenceName}.nextval into :new."' || PK_NAME || '" from dual;` +
      `            select count("' || PK_NAME || '") into checking from ${to}` +
      `            where "' || PK_NAME || '" = :new."' || PK_NAME || '";` +
      `          end loop;` +
      `        end if;` +
      `      end;');` +
      `  end if;` +
      `END;`
    );
  },
};

module.exports = trigger;
