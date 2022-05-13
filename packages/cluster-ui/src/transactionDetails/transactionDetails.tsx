// Copyright 2021 The Cockroach Authors.
//
// Use of this software is governed by the Business Source License
// included in the file licenses/BSL.txt.
//
// As of the Change Date specified in that file, in accordance with
// the Business Source License, use of this software will be governed
// by the Apache License, Version 2.0, included in the file
// licenses/APL.txt.

import React from "react";
import * as protos from "@cockroachlabs/crdb-protobuf-client";
import classNames from "classnames/bind";
import _ from "lodash";
import { RouteComponentProps } from "react-router-dom";

import statementsStyles from "../statementsPage/statementsPage.module.scss";
import {
  SortedTable,
  ISortedTablePagination,
  SortSetting,
} from "../sortedtable";
import { PageConfig, PageConfigItem } from "src/pageConfig";
import { InlineAlert, Tooltip } from "@cockroachlabs/ui-components";
import { Pagination } from "../pagination";
import { TableStatistics } from "../tableStatistics";
import { baseHeadingClasses } from "../transactionsPage/transactionsPageClasses";
import { Button } from "../button";
import { tableClasses } from "../transactionsTable/transactionsTableClasses";
import { SqlBox } from "../sql";
import {
  aggregateStatements,
  getStatementsByFingerprintId,
  statementFingerprintIdsToText,
} from "../transactionsPage/utils";
import { Loading } from "../loading";
import { SummaryCard } from "../summaryCard";
import {
  Bytes,
  calculateTotalWorkload,
  Duration,
  formatNumberForDisplay,
} from "src/util";
import { UIConfigState } from "../store";
import SQLActivityError from "../sqlActivity/errorComponent";

import summaryCardStyles from "../summaryCard/summaryCard.module.scss";
import transactionDetailsStyles from "./transactionDetails.modules.scss";
import { Col, Row } from "antd";
import { Text, Heading } from "@cockroachlabs/ui-components";
import { formatTwoPlaces } from "../barCharts";
import { ArrowLeft } from "@cockroachlabs/icons";
import {
  populateRegionNodeForStatements,
  makeStatementsColumns,
} from "src/statementsTable/statementsTable";
import { Transaction } from "src/transactionsTable";
import Long from "long";
import { StatementsRequest } from "../api";
import {
  TimeScale,
  TimeScaleDropdown,
  toDateRange,
} from "../timeScaleDropdown";

const { containerClass } = tableClasses;
const cx = classNames.bind(statementsStyles);

type Statement = protos.cockroach.server.serverpb.StatementsResponse.ICollectedStatementStatistics;

const summaryCardStylesCx = classNames.bind(summaryCardStyles);
const transactionDetailsStylesCx = classNames.bind(transactionDetailsStyles);

export interface TransactionDetailsStateProps {
  timeScale: TimeScale;
  error?: Error | null;
  isTenant: UIConfigState["isTenant"];
  hasViewActivityRedactedRole?: UIConfigState["hasViewActivityRedactedRole"];
  nodeRegions: { [nodeId: string]: string };
  statements?: Statement[];
  transaction: Transaction;
  transactionFingerprintId: string;
  isLoading: boolean;
}

export interface TransactionDetailsDispatchProps {
  refreshData: (req?: StatementsRequest) => void;
  refreshUserSQLRoles: () => void;
  onTimeScaleChange: (ts: TimeScale) => void;
}

export type TransactionDetailsProps = TransactionDetailsStateProps &
  TransactionDetailsDispatchProps &
  RouteComponentProps;

interface TState {
  sortSetting: SortSetting;
  pagination: ISortedTablePagination;
  latestTransactionText: string;
}

function statementsRequestFromProps(
  props: TransactionDetailsProps,
): protos.cockroach.server.serverpb.StatementsRequest {
  const [start, end] = toDateRange(props.timeScale);
  return new protos.cockroach.server.serverpb.StatementsRequest({
    combined: true,
    start: Long.fromNumber(start.unix()),
    end: Long.fromNumber(end.unix()),
  });
}

export class TransactionDetails extends React.Component<
  TransactionDetailsProps,
  TState
> {
  constructor(props: TransactionDetailsProps) {
    super(props);
    this.state = {
      sortSetting: {
        // Sort by statement latency as default column.
        ascending: false,
        columnTitle: "statementTime",
      },
      pagination: {
        pageSize: 10,
        current: 1,
      },
      latestTransactionText: "",
    };
  }

  static defaultProps: Partial<TransactionDetailsProps> = {
    isTenant: false,
    hasViewActivityRedactedRole: false,
  };

  getTransactionStateInfo = (prevTransactionFingerprintId: string): void => {
    const { transaction, transactionFingerprintId } = this.props;

    const statementFingerprintIds =
      transaction?.stats_data?.statement_fingerprint_ids;

    const transactionText =
      (statementFingerprintIds &&
        statementFingerprintIdsToText(
          statementFingerprintIds,
          this.getStatementsForTransaction(),
        )) ||
      "";

    // If a new, non-empty-string transaction text is available (derived from the time-frame-specific endpoint
    // response), cache the text.
    if (
      transactionText &&
      transactionText != this.state.latestTransactionText
    ) {
      this.setState({
        latestTransactionText: transactionText,
      });
    }

    // If the transactionFingerprintId (derived from the URL) changes, invalidate the cached transaction text
    if (prevTransactionFingerprintId != transactionFingerprintId) {
      this.setState({
        latestTransactionText: "",
      });
    }
  };

  refreshData = (prevTransactionFingerprintId: string): void => {
    const req = statementsRequestFromProps(this.props);
    this.props.refreshData(req);
    this.getTransactionStateInfo(prevTransactionFingerprintId);
  };

  componentDidMount(): void {
    this.refreshData("");
    this.props.refreshUserSQLRoles();
  }

  componentDidUpdate(prevProps: TransactionDetailsProps): void {
    this.getTransactionStateInfo(prevProps.transactionFingerprintId);
  }

  onChangeSortSetting = (ss: SortSetting): void => {
    this.setState({
      sortSetting: ss,
    });
  };

  onChangePage = (current: number): void => {
    const { pagination } = this.state;
    this.setState({ pagination: { ...pagination, current } });
  };

  backToTransactionsClick = (): void => {
    this.props.history.push("/sql-activity?tab=Transactions&view=fingerprints");
  };

  getStatementsForTransaction = (): Statement[] => {
    const { transaction, statements } = this.props;

    const statementFingerprintIds =
      transaction?.stats_data?.statement_fingerprint_ids;

    return (
      (statementFingerprintIds &&
        getStatementsByFingerprintId(statementFingerprintIds, statements)) ||
      []
    );
  };

  render(): React.ReactElement {
    const {
      error,
      nodeRegions,
      transaction,
      transactionFingerprintId,
    } = this.props;
    const { latestTransactionText } = this.state;
    const statementsForTransaction = this.getStatementsForTransaction();
    const transactionStats = transaction?.stats_data?.stats;

    return (
      <div>
        <section className={baseHeadingClasses.wrapper}>
          <Button
            onClick={this.backToTransactionsClick}
            type="unstyled-link"
            size="small"
            icon={<ArrowLeft fontSize={"10px"} />}
            iconPosition="left"
            className="small-margin"
          >
            Transactions
          </Button>
          <h3 className={baseHeadingClasses.tableName}>Transaction Details</h3>
        </section>
        <PageConfig>
          <PageConfigItem>
            <TimeScaleDropdown
              currentScale={this.props.timeScale}
              setTimeScale={this.props.onTimeScaleChange}
            />
          </PageConfigItem>
        </PageConfig>
        <Loading
          error={error}
          page={"transaction details"}
          loading={this.props.isLoading}
          render={() => {
            if (!transaction) {
              return (
                <section className={containerClass}>
                  {latestTransactionText && (
                    <Row
                      gutter={16}
                      className={transactionDetailsStylesCx("summary-columns")}
                    >
                      <Col span={16}>
                        <SqlBox
                          value={latestTransactionText}
                          className={transactionDetailsStylesCx("summary-card")}
                        />
                      </Col>
                    </Row>
                  )}
                  <InlineAlert
                    intent="info"
                    title="Data not available for this time frame. Select a different time frame."
                  />
                </section>
              );
            }

            const { isTenant, hasViewActivityRedactedRole } = this.props;
            const { sortSetting, pagination } = this.state;
            const txnScopedStmts = statementsForTransaction.filter(
              s =>
                s.key.key_data.transaction_fingerprint_id.toString() ===
                transactionFingerprintId,
            );
            const aggregatedStatements = aggregateStatements(txnScopedStmts);
            populateRegionNodeForStatements(
              aggregatedStatements,
              nodeRegions,
              isTenant,
            );
            const duration = (v: number) => Duration(v * 1e9);

            const transactionSampled =
              transactionStats.exec_stats.count > Long.fromNumber(0);
            const unavailableTooltip = !transactionSampled && (
              <Tooltip
                placement="bottom"
                style="default"
                content={
                  <p>
                    This metric is part of the transaction execution and
                    therefore will not be available until it is sampled via
                    tracing.
                  </p>
                }
              >
                <span className={cx("tooltip-info")}>unavailable</span>
              </Tooltip>
            );

            return (
              <React.Fragment>
                <section className={containerClass}>
                  <Row
                    gutter={16}
                    className={transactionDetailsStylesCx("summary-columns")}
                  >
                    <Col span={16}>
                      <SqlBox
                        value={latestTransactionText}
                        className={transactionDetailsStylesCx("summary-card")}
                      />
                    </Col>
                    <Col span={8}>
                      <SummaryCard
                        className={transactionDetailsStylesCx("summary-card")}
                      >
                        <div
                          className={summaryCardStylesCx("summary--card__item")}
                        >
                          <Heading type="h5">Mean transaction time</Heading>
                          <Text>
                            {formatNumberForDisplay(
                              transactionStats?.service_lat.mean,
                              duration,
                            )}
                          </Text>
                        </div>
                        <p
                          className={summaryCardStylesCx(
                            "summary--card__divider",
                          )}
                        />
                        <div
                          className={summaryCardStylesCx("summary--card__item")}
                        >
                          <Heading type="h5">
                            Transaction resource usage
                          </Heading>
                        </div>
                        <div
                          className={summaryCardStylesCx("summary--card__item")}
                        >
                          <Text>Mean rows/bytes read</Text>
                          <Text>
                            {formatNumberForDisplay(
                              transactionStats.rows_read.mean,
                              formatTwoPlaces,
                            )}
                            {" / "}
                            {formatNumberForDisplay(
                              transactionStats.bytes_read.mean,
                              Bytes,
                            )}
                          </Text>
                        </div>
                        <div
                          className={summaryCardStylesCx("summary--card__item")}
                        >
                          <Text>Bytes read over network</Text>
                          {transactionSampled && (
                            <Text>
                              {formatNumberForDisplay(
                                transactionStats.exec_stats.network_bytes.mean,
                                Bytes,
                              )}
                            </Text>
                          )}
                          {unavailableTooltip}
                        </div>
                        <div
                          className={summaryCardStylesCx("summary--card__item")}
                        >
                          <Text>Mean rows written</Text>
                          <Text>
                            {formatNumberForDisplay(
                              transactionStats.rows_written?.mean,
                              formatTwoPlaces,
                            )}
                          </Text>
                        </div>
                        <div
                          className={summaryCardStylesCx("summary--card__item")}
                        >
                          <Text>Max memory usage</Text>
                          {transactionSampled && (
                            <Text>
                              {formatNumberForDisplay(
                                transactionStats.exec_stats.max_mem_usage.mean,
                                Bytes,
                              )}
                            </Text>
                          )}
                          {unavailableTooltip}
                        </div>
                        <div
                          className={summaryCardStylesCx("summary--card__item")}
                        >
                          <Text>Max scratch disk usage</Text>
                          {transactionSampled && (
                            <Text>
                              {formatNumberForDisplay(
                                _.get(
                                  transactionStats,
                                  "exec_stats.max_disk_usage.mean",
                                  0,
                                ),
                                Bytes,
                              )}
                            </Text>
                          )}
                          {unavailableTooltip}
                        </div>
                      </SummaryCard>
                    </Col>
                  </Row>
                  <TableStatistics
                    pagination={pagination}
                    totalCount={statementsForTransaction.length}
                    arrayItemName={
                      "statement fingerprints for this transaction"
                    }
                    activeFilters={0}
                  />
                  <div className={cx("table-area")}>
                    <SortedTable
                      data={aggregatedStatements}
                      columns={makeStatementsColumns(
                        aggregatedStatements,
                        [],
                        calculateTotalWorkload(aggregatedStatements),
                        nodeRegions,
                        "transactionDetails",
                        isTenant,
                        hasViewActivityRedactedRole,
                      )}
                      className={cx("statements-table")}
                      sortSetting={sortSetting}
                      onChangeSortSetting={this.onChangeSortSetting}
                    />
                  </div>
                </section>
                <Pagination
                  pageSize={pagination.pageSize}
                  current={pagination.current}
                  total={statementsForTransaction.length}
                  onChange={this.onChangePage}
                />
              </React.Fragment>
            );
          }}
          renderError={() =>
            SQLActivityError({
              statsType: "transactions",
            })
          }
        />
      </div>
    );
  }
}
