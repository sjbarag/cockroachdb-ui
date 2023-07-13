import React, { useEffect, useMemo } from "react";
import { notification, Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Button, Icon, Spinner } from "@cockroachlabs/ui-components";
import { useO11yUiContext } from "../context";

export interface Database {
  name: string,
  sizeInBytes: number,
  tableCount: number,
  rangeCount: number,
  /** Array of node IDs used to unambiguously filter by node and region. */
  nodes?: number[]
  /**
   * String of nodes grouped by region in alphabetical order, e.g.
   * regionA(n1,n2), regionB(n3). Used for display in the table's
   * "Regions/Nodes" column.
   */
  nodesByRegionString?: string;
  numIndexRecommendations: number;
}

export interface DatabasesTableProps {
  databases: Database[],
  loading: boolean,
  error: Error | null,
  refresh: () => void,
  dbLinkPrefix: string,
}

const HEADER_COMPONENTS = {
  databases: (
    <Tooltip placement="bottom" title="The name of the database.">
      Databases
    </Tooltip>
  ),
  size: (
    <Tooltip placement="bottom" title="The approximate total disk size across all table replicas in the database">
      Size
    </Tooltip>
  ),
  tables: (
    <Tooltip placement="bottom" title="The total number of tables in the database.">
      Tables
    </Tooltip>
  ),
  ranges: (
    <Tooltip placement="bottom" title="The total number of ranges across all tables in the database.">
      Range Count
    </Tooltip>
  ),
  recommendations: (
    <Tooltip placement="bottom" title="Index recommendations will appear if the system detects improper index usage, such as the
        occurrence of unused indexes. Following index recommendations may help improve query performance.">
      Index Recommendations
    </Tooltip>
  ),
  // TODO: Regions
} as const;

export const DatabasesTable = (props: DatabasesTableProps) => {
  const ctx = useO11yUiContext();
  const CtxLink = ctx.Link;

  const columns = useMemo((): ColumnsType<Database> => {
    // TODO: Replace this with a better formatter. Probably the one copied from CRDB.
    const storageFormatter = new Intl.NumberFormat("en-US", {
      unit: "byte",
      style: "unit",
      notation: "compact",
      unitDisplay: "narrow",
    });

    return [
      {
        key: "name",
        title: HEADER_COMPONENTS.databases,
        dataIndex: "name",
        render: (_value, db) => <span>
          <Icon iconName="Stack" size="small"/>
          <CtxLink to={`${props.dbLinkPrefix}/${db.name}`}>{db.name}</CtxLink>
        </span>,
      },
      {
        key: "size",
        title: HEADER_COMPONENTS.size,
        dataIndex: "sizeInBytes",
        align: "right",
        render: (_value, db) => storageFormatter.format(db.sizeInBytes),
      },
      {
        key: "tables",
        title: HEADER_COMPONENTS.tables,
        dataIndex: "tableCount",
        align: "right",
      },
      {
        key: "ranges",
        title: HEADER_COMPONENTS.ranges,
        dataIndex: "rangeCount",
        align: "right",
      },
      // TODO: Regions
      {
        key: "recommendations",
        title: HEADER_COMPONENTS.recommendations,
        dataIndex: "numIndexRecommendations",
        render: (_value, db) => db.numIndexRecommendations < 1 ? "None" : db.numIndexRecommendations,
      },
    ];
  }, [CtxLink]);

  useEffect(() => {
    if (props.error == null) {
      return;
    }

    notification.error({
      message: "heck, it failed to load"
    });
  }, [props.error]);

  if (props.loading && props.databases.length === 0) {
    return <Spinner/>;
  }

  return <>
    <Button intent="secondary" onClick={props.refresh}>
      <Icon iconName="Refresh" size="small"/>
      { props.loading ? "Refreshing..." : "Refresh" }
    </Button>
    <Table<Database>
      // Use the "name" field as the React key instead of providing a separate "key"
      rowKey="name"
      columns={columns}
      dataSource={props.databases}
    />
  </>;
}
